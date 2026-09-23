import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { JsonRepository } from "./json-repository";
import { DatabaseSchema } from "./database";

const directories: string[] = [];
async function repository() {
  const directory = await mkdtemp(join(tmpdir(), "hackalem-repository-test-"));
  directories.push(directory);
  return new JsonRepository(join(directory, "db.json"));
}
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    if (dirname(resolve(directory)) !== resolve(tmpdir()) || !directory.includes("hackalem-repository-test-")) throw new Error("Unsafe cleanup path");
    await rm(directory, { recursive: true, force: true });
  }
});

describe("JSON persistence", () => {
  it("initializes five complete fixture sets only once, even for concurrent readers", async () => {
    const repo = await repository();
    const reads = await Promise.all(Array.from({ length: 8 }, () => new JsonRepository(repo.filePath).read()));
    for (const data of reads) {
      expect(data.tasks).toHaveLength(5);
      expect(data.teams).toHaveLength(5);
      expect(data.proposals).toHaveLength(5);
      expect(new Set(data.tasks.map((task) => task.initialDescription)).size).toBe(5);
    }
  });
  it("serializes independent writers without losing updates and survives a new instance", async () => {
    const repo = await repository();
    await repo.read();
    await Promise.all(Array.from({ length: 15 }, (_, index) => new JsonRepository(repo.filePath).transaction((data) => {
      data.teams.push({ ...data.teams[0], id: `added-${index}` });
    })));
    const saved = await new JsonRepository(repo.filePath).read();
    expect(saved.teams).toHaveLength(20);
    expect(DatabaseSchema.safeParse(JSON.parse(await readFile(repo.filePath, "utf8"))).success).toBe(true);
  });
  it("does not persist half a failed transaction", async () => {
    const repo = await repository();
    await repo.read();
    await expect(repo.transaction((data) => {
      data.tasks[0].title = "Broken";
      throw new Error("Rejected");
    })).rejects.toThrow("Rejected");
    expect((await repo.read()).tasks[0].title).toBe("Учёт остатков пекарни");
    await repo.transaction((data) => { data.tasks[0].title = "Works after failure"; });
    expect((await repo.read()).tasks[0].title).toBe("Works after failure");
  });
  it("does not overwrite corrupted data with seed", async () => {
    const repo = await repository();
    await writeFile(repo.filePath, "{broken", "utf8");
    await expect(repo.read()).rejects.toMatchObject({ code: "STORAGE_INVALID" });
    await expect(repo.transaction(() => null)).rejects.toMatchObject({ code: "STORAGE_INVALID" });
    expect(await readFile(repo.filePath, "utf8")).toBe("{broken");
  });
});
