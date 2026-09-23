import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";
import { withFileLock } from "./file-lock";
import { JsonRepository } from "./json-repository";

const directories: string[] = [];
const quick = { timeoutMs: 70, retryMs: 2 };

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "hackalem-lock-test-"));
  directories.push(directory);
  return { directory, lockPath: join(directory, "db.json.lock"), databasePath: join(directory, "db.json") };
}

async function writeOwner(lockPath: string, overrides: Record<string, unknown> = {}) {
  const token = randomUUID();
  await mkdir(lockPath);
  const filePath = join(lockPath, `owner-${token}.json`);
  const source = JSON.stringify({ version: 1, token, pid: process.pid, hostname: hostname(), ...overrides });
  await writeFile(filePath, source, "utf8");
  return { filePath, source };
}

async function deadPid() {
  const child = spawn(process.execPath, ["-e", "process.exit(0)"], { stdio: "ignore", windowsHide: true });
  await once(child, "exit");
  if (!child.pid) throw new Error("Child process did not start");
  expect(() => process.kill(child.pid!, 0)).toThrow();
  return child.pid;
}

async function runChild(script: string, ...args: string[]) {
  const child = spawn(process.execPath, ["--input-type=module", "-e", script, ...args], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
  let stderr = "";
  child.stderr!.on("data", (chunk) => { stderr += chunk; });
  const [code] = await once(child, "close");
  if (code !== 0) throw new Error(`Lock worker failed (${code}): ${stderr}`);
}

async function compileLockForChild(directory: string) {
  // Run the real implementation in independent Node processes, not a reimplementation or mock.
  for (const [sourceName, outputName] of [["../errors.ts", "errors.mjs"], ["./file-lock.ts", "file-lock.mjs"]]) {
    const source = (await readFile(new URL(sourceName, import.meta.url), "utf8")).replace('"../errors"', '"./errors.mjs"');
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
    await writeFile(join(directory, outputName), compiled.outputText, "utf8");
  }
  return join(directory, "file-lock.mjs");
}

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    if (dirname(resolve(directory)) !== resolve(tmpdir()) || !directory.includes("hackalem-lock-test-")) throw new Error("Unsafe cleanup path");
    await rm(directory, { recursive: true, force: true });
  }
});

describe("single-host recoverable file lock", () => {
  it("publishes owner metadata before entering the operation and removes its lock afterwards", async () => {
    const { directory, lockPath } = await fixture();
    await withFileLock(lockPath, async () => {
      const files = await readdir(lockPath);
      expect(files).toHaveLength(1);
      expect(JSON.parse(await readFile(join(lockPath, files[0]), "utf8"))).toMatchObject({ version: 1, pid: process.pid, hostname: hostname() });
    });
    expect(await readdir(directory)).toEqual([]);
  });

  it("recovers a dead owner and preserves the existing database", async () => {
    const { lockPath, databasePath } = await fixture();
    const repository = new JsonRepository(databasePath);
    await repository.transaction((data) => { data.tasks[0].title = "Saved before the crash"; });
    await writeOwner(lockPath, { pid: await deadPid() });
    await new JsonRepository(databasePath).transaction((data) => { data.teams.push({ ...data.teams[0], id: "after-restart" }); });
    const data = await repository.read();
    expect(data.tasks[0].title).toBe("Saved before the crash");
    expect(data.teams).toHaveLength(6);
    await expect(readdir(lockPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not evict a living owner even when the wait deadline expires", async () => {
    const { directory, lockPath } = await fixture();
    const owner = await writeOwner(lockPath);
    await expect(withFileLock(lockPath, async () => "should not enter", quick)).rejects.toMatchObject({ code: "STORAGE_BUSY" });
    expect(await readFile(owner.filePath, "utf8")).toBe(owner.source);
    expect(await readdir(directory)).toEqual(["db.json.lock"]);
  });

  it("serializes concurrent recoverers and never removes an active replacement lock", async () => {
    const { directory, lockPath } = await fixture();
    await writeOwner(lockPath, { pid: await deadPid() });
    let active = 0;
    let maximumActive = 0;
    let count = 0;
    const outcomes = await Promise.allSettled(Array.from({ length: 32 }, () => withFileLock(lockPath, async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      const previous = count;
      const [filename] = await readdir(lockPath);
      await setTimeout(3);
      expect(await readdir(lockPath)).toEqual([filename]);
      count = previous + 1;
      active -= 1;
    }, { retryMs: 1 })));
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toEqual([]);
    expect(maximumActive).toBe(1);
    expect(count).toBe(32);
    expect(await readdir(directory)).toEqual([]);
  });

  it("recovers an empty directory left by a crash during cleanup", async () => {
    const { directory, lockPath } = await fixture();
    await mkdir(lockPath);
    await expect(withFileLock(lockPath, async () => "recovered", quick)).resolves.toBe("recovered");
    expect(await readdir(directory)).toEqual([]);
  });

  it("recovers an actually exited owner and serializes independent processes", async () => {
    const { directory, lockPath } = await fixture();
    const modulePath = await compileLockForChild(directory);
    const prelude = `
      import { pathToFileURL } from 'node:url';
      const { withFileLock } = await import(pathToFileURL(process.argv[1]).href);
      const lockPath = process.argv[2];
    `;
    await runChild(`${prelude} await withFileLock(lockPath, async () => process.exit(0));`, modulePath, lockPath);
    expect(await readdir(lockPath)).toHaveLength(1);
    const countPath = join(directory, "counter.txt");
    await writeFile(countPath, "0", "utf8");
    const worker = `${prelude}
      import { readFile, writeFile } from 'node:fs/promises';
      import { setTimeout } from 'node:timers/promises';
      for (let i = 0; i < 10; i += 1) {
        await withFileLock(lockPath, async () => {
          const count = Number(await readFile(process.argv[3], 'utf8'));
          await setTimeout(2);
          await writeFile(process.argv[3], String(count + 1), 'utf8');
        }, { retryMs: 2 });
      }
    `;
    const outcomes = await Promise.allSettled(Array.from({ length: 6 }, () => runChild(worker, modulePath, lockPath, countPath)));
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toEqual([]);
    expect(await readFile(countPath, "utf8")).toBe("60");
    await expect(readdir(lockPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("releases the lock after a rejected operation", async () => {
    const { lockPath } = await fixture();
    await expect(withFileLock(lockPath, async () => { throw new Error("Rejected"); })).rejects.toThrow("Rejected");
    await expect(withFileLock(lockPath, async () => "next operation", quick)).resolves.toBe("next operation");
  });

  it("fails closed for legacy empty lock files rather than deleting a potentially live old-server lock", async () => {
    const { directory, lockPath } = await fixture();
    await writeFile(lockPath, "", "utf8");
    await expect(withFileLock(lockPath, async () => null, quick)).rejects.toMatchObject({ code: "STORAGE_LOCK_INVALID" });
    expect(await readFile(lockPath, "utf8")).toBe("");
    expect(await readdir(directory)).toEqual(["db.json.lock"]);
  });

  it.each([
    ["unknown version", { version: 2 }],
    ["foreign host", { hostname: `${hostname()}-other` }],
    ["invalid PID", { pid: -1 }],
    ["mismatched token", { token: randomUUID() }],
  ])("does not alter locks with %s", async (_label, overrides) => {
    const { lockPath } = await fixture();
    const owner = await writeOwner(lockPath, overrides);
    await expect(withFileLock(lockPath, async () => null, quick)).rejects.toMatchObject({ code: "STORAGE_LOCK_INVALID" });
    expect(await readFile(owner.filePath, "utf8")).toBe(owner.source);
  });

  it("does not delete a corrupt owner file", async () => {
    const { lockPath } = await fixture();
    const owner = await writeOwner(lockPath);
    await writeFile(owner.filePath, "{broken", "utf8");
    await expect(withFileLock(lockPath, async () => null, quick)).rejects.toMatchObject({ code: "STORAGE_LOCK_INVALID" });
    expect(await readFile(owner.filePath, "utf8")).toBe("{broken");
  });
});
