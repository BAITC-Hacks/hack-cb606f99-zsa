import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { JsonRepository } from "./json-repository";

const directories: string[] = [];
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "hackalem-readiness-test-"));
  directories.push(directory);
  return { directory, repo: new JsonRepository(join(directory, "db.json")) };
}
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    if (dirname(resolve(directory)) !== resolve(tmpdir()) || !directory.includes("hackalem-readiness-test-")) throw new Error("Unsafe cleanup path");
    await rm(directory, { recursive: true, force: true });
  }
});

describe("storage readiness", () => {
  it("initializes a new database and checks the read/write path without leftovers", async () => {
    const { repo, directory } = await fixture();
    expect((await repo.checkReadiness()).tasks).toHaveLength(5);
    expect(await readdir(directory)).toEqual(["db.json"]);
  });

  it("does not rewrite existing records or their on-disk format", async () => {
    const { repo, directory } = await fixture();
    await repo.read();
    const source = await readFile(repo.filePath, "utf8");
    await Promise.all([repo.checkReadiness(), repo.checkReadiness()]);
    expect(await readFile(repo.filePath, "utf8")).toBe(source);
    expect(await readdir(directory)).toEqual(["db.json"]);
  });

  it("reports damaged data without replacing it", async () => {
    const { repo, directory } = await fixture();
    await writeFile(repo.filePath, "{broken", "utf8");
    await expect(repo.checkReadiness()).rejects.toMatchObject({ code: "STORAGE_INVALID", status: 503 });
    expect(await readFile(repo.filePath, "utf8")).toBe("{broken");
    expect(await readdir(directory)).toEqual(["db.json"]);
  });

  it("does not claim readiness when reads work but an unknown lock prevents writes", async () => {
    const { repo } = await fixture();
    await repo.read();
    await writeFile(`${repo.filePath}.lock`, "", "utf8");
    expect((await repo.read()).tasks).toHaveLength(5);
    await expect(repo.checkReadiness()).rejects.toMatchObject({ code: "STORAGE_LOCK_INVALID", status: 503 });
    expect(await readFile(`${repo.filePath}.lock`, "utf8")).toBe("");
  });
});
