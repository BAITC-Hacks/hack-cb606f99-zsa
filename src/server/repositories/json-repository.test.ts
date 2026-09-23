import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { JsonRepository } from "./json-repository";
import { DatabaseSchema } from "./database";
import { createSeed } from "./seed";
import { PlatformService } from "../services/platform";

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

  it("loads legacy version 1 without milestones and preserves existing collections on first milestone write", async () => {
    const repo = await repository();
    const seed = createSeed();
    seed.tasks[0].title = "Existing user-edited task";
    const legacy = { schemaVersion: 1, tasks: seed.tasks, teams: seed.teams, proposals: seed.proposals };
    const source = JSON.stringify(legacy);
    await writeFile(repo.filePath, source, "utf8");
    const loaded = await repo.read();
    expect(loaded).toEqual({ ...legacy, milestones: [] });
    // A read performs no migration write and never re-seeds existing records.
    expect(await readFile(repo.filePath, "utf8")).toBe(source);

    const platform = new PlatformService(repo);
    const { milestone } = await platform.createMilestone("proposal-1", {
      title: "Existing project's next stage", description: "Show a tested CSV import.",
    });
    const persisted = JSON.parse(await readFile(repo.filePath, "utf8"));
    expect(persisted.schemaVersion).toBe(1);
    expect(persisted.tasks).toEqual(legacy.tasks);
    expect(persisted.teams).toEqual(legacy.teams);
    expect(persisted.proposals).toEqual(legacy.proposals);
    expect(persisted.milestones).toEqual([milestone]);
    expect((await new JsonRepository(repo.filePath).read()).milestones).toEqual([milestone]);
  });

  it("serializes confirmations across repository instances and restores derived points after restart", async () => {
    const repo = await repository();
    const first = new PlatformService(repo);
    const second = new PlatformService(new JsonRepository(repo.filePath));
    const { milestone } = await first.createMilestone("proposal-1", {
      title: "CSV import", description: "Validate imported sales and show a chart.",
    });
    await first.submitMilestone(milestone.id, { report: "Import and chart validated on five rows.", expectedVersion: 1 });
    const confirmations = await Promise.all([
      first.reviewMilestone(milestone.id, { decision: "confirm", expectedVersion: 2 }),
      second.reviewMilestone(milestone.id, { decision: "confirm", expectedVersion: 2 }),
    ]);
    expect(confirmations[0]).toEqual(confirmations[1]);
    expect(confirmations[0].milestone.version).toBe(3);
    const restarted = new PlatformService(new JsonRepository(repo.filePath));
    expect((await restarted.getTeam("team-1")).team.points).toBe(10);
    expect((await restarted.listMilestones("task-1")).milestones).toEqual([confirmations[0].milestone]);
    const persisted = JSON.parse(await readFile(repo.filePath, "utf8"));
    expect(persisted.teams.every((team: object) => !("points" in team))).toBe(true);
    await restarted.decideProposal("proposal-1", { status: "rejected" });
    const afterDecision = new PlatformService(new JsonRepository(repo.filePath));
    expect((await afterDecision.getTeam("team-1")).team.points).toBe(10);
    expect((await afterDecision.listMilestones("task-1")).milestones[0]).toEqual(confirmations[0].milestone);
    await afterDecision.archiveTask("task-1", {});
    expect((await new PlatformService(new JsonRepository(repo.filePath)).getTeam("team-1")).team.points).toBe(10);
  });

  it("allows only one competing review of the same submitted version", async () => {
    const repo = await repository();
    const first = new PlatformService(repo);
    const second = new PlatformService(new JsonRepository(repo.filePath));
    const { milestone } = await first.createMilestone("proposal-1", { title: "Demo", description: "Show a working import." });
    await first.submitMilestone(milestone.id, { report: "Import is ready.", expectedVersion: 1 });
    const results = await Promise.allSettled([
      first.reviewMilestone(milestone.id, { decision: "confirm", expectedVersion: 2 }),
      second.reviewMilestone(milestone.id, { decision: "request_changes", comment: "Check empty files.", expectedVersion: 2 }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.status === "rejected" ? rejected.reason : null).toMatchObject({ code: "VERSION_CONFLICT" });
    const saved = (await first.listMilestones("task-1")).milestones[0];
    expect(saved.version).toBe(3);
    expect((await first.getTeam("team-1")).team.points).toBe(saved.status === "confirmed" ? 10 : 0);
  });

  it("does not silently discard malformed milestone data or trust stored team points", async () => {
    const repo = await repository();
    const seed = createSeed();
    const source = JSON.stringify({ ...seed, milestones: [{ id: "broken-stage", points: 1000 }] });
    await writeFile(repo.filePath, source, "utf8");
    await expect(repo.read()).rejects.toMatchObject({ code: "STORAGE_INVALID" });
    await expect(repo.transaction(() => null)).rejects.toMatchObject({ code: "STORAGE_INVALID" });
    expect(await readFile(repo.filePath, "utf8")).toBe(source);

    await writeFile(repo.filePath, JSON.stringify({ ...seed, teams: seed.teams.map((team) => ({ ...team, points: 9000 })) }), "utf8");
    const platform = new PlatformService(new JsonRepository(repo.filePath));
    expect((await platform.listTeams()).teams.every((team) => team.points === 0)).toBe(true);
  });

  it("rejects duplicate, orphaned and mismatched milestone references without replacing data", async () => {
    const repo = await repository();
    const platform = new PlatformService(repo);
    const { milestone } = await platform.createMilestone("proposal-1", { title: "Demo", description: "Show a working import." });
    const valid = await repo.read();
    for (const milestones of [
      [milestone, { ...milestone }],
      [{ ...milestone, proposalId: "missing-proposal" }],
      [{ ...milestone, taskId: "missing-task" }],
      [{ ...milestone, teamId: "missing-team" }],
      [{ ...milestone, taskId: "task-2" }],
      [{ ...milestone, teamId: "team-2" }],
    ]) {
      const source = JSON.stringify({ ...valid, milestones });
      await writeFile(repo.filePath, source, "utf8");
      await expect(repo.read()).rejects.toMatchObject({ code: "STORAGE_INVALID" });
      await expect(repo.transaction(() => null)).rejects.toMatchObject({ code: "STORAGE_INVALID" });
      expect(await readFile(repo.filePath, "utf8")).toBe(source);
    }
  });
});
