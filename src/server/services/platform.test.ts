import { beforeEach, describe, expect, it } from "vitest";
import { TASK_FIELDS, TaskCardFieldsSchema, TaskResponseSchema, ProposalResponseSchema } from "../../shared/contracts";
import type { Database, Repository } from "../repositories/database";
import { createSeed } from "../repositories/seed";
import { PlatformService } from "./platform";

class MemoryRepository implements Repository {
  data = createSeed();
  async read() { return structuredClone(this.data); }
  async transaction<T>(change: (data: Database) => T) {
    const copy = structuredClone(this.data);
    const result = change(copy);
    this.data = copy;
    return result;
  }
}
let service: PlatformService;
beforeEach(() => { service = new PlatformService(new MemoryRepository()); });

const draft = { initialDescription: "Хочу сократить списания в своей пекарне", title: "Остатки пекарни", confirmedFields: ["title"] };
const proposal = { teamId: "team-1", solutionIdea: "Панель остатков", plan: "Импорт CSV и график", estimatedDuration: "1 неделя", prototypeUrl: "https://example.com/demo" };

describe("business workflow", () => {
  it("publishes a zero-score card and accepts multiple proposals without restricting teams", async () => {
    const { task } = await service.createTask(draft);
    expect(task.score).toBe(0);
    expect(task.status).toBe("draft");
    expect(TaskResponseSchema.safeParse({ task }).success).toBe(true);
    await service.publishTask(task.id, { confirmed: true });
    expect((await service.listTasks()).tasks.some((item) => item.id === task.id)).toBe(true);
    const first = await service.createProposal(task.id, proposal);
    const second = await service.createProposal(task.id, { ...proposal, teamId: "team-2" });
    const third = await service.createProposal(task.id, proposal);
    for (const item of [first, second]) {
      const accepted = await service.decideProposal(item.proposal.id, { status: "accepted" });
      expect(ProposalResponseSchema.safeParse(accepted).success).toBe(true);
    }
    await service.decideProposal(third.proposal.id, { status: "rejected", decisionComment: "Уточните план" });
    expect((await service.listProposals({ status: "accepted" }, task.id)).total).toBe(2);
    expect((await service.listProposals({}, task.id)).total).toBe(3);
    expect((await service.listProposals({ teamId: "team-2" }, task.id)).total).toBe(1);
  });
  it("recalculates scores, invalidates edited confirmations and supports explicit reconfirmation", async () => {
    const fields = TaskCardFieldsSchema.parse(createSeed().tasks[0]);
    const { task } = await service.createTask({ ...fields, confirmedFields: TASK_FIELDS });
    expect(task.score).toBe(100);
    const changed = await service.updateTask(task.id, { successCriteria: "Ошибка не более 10%", expectedVersion: 1 });
    expect(changed.task.score).toBe(85);
    expect(changed.task.unconfirmedFields).toContain("successCriteria");
    const reconfirmed = await service.updateTask(task.id, { confirmedFields: TASK_FIELDS, expectedVersion: 2 });
    expect(reconfirmed.task.score).toBe(100);
    const cleared = await service.updateTask(task.id, { dataAndMaterials: "" });
    expect(cleared.task.score).toBe(80);
    expect(cleared.task.missingFields).toContain("dataAndMaterials");
    const newSource = await service.updateTask(task.id, { initialDescription: "Теперь нужен другой сценарий учёта" });
    expect(newSource.task.confirmedFields).toEqual([]);
  });
  it("rejects stale edits without losing a saved change", async () => {
    const { task } = await service.createTask(draft);
    await service.updateTask(task.id, { title: "Новое название", expectedVersion: 1 });
    await expect(service.updateTask(task.id, { title: "Старое изменение", expectedVersion: 1 })).rejects.toMatchObject({ status: 409 });
    expect((await service.getTask(task.id)).task.title).toBe("Новое название");
  });
  it("requires human review and rejects empty confirmations and client-written scores", async () => {
    const { task } = await service.createTask({ initialDescription: draft.initialDescription });
    await expect(service.publishTask(task.id, { confirmed: true })).rejects.toMatchObject({ code: "REVIEW_REQUIRED" });
    await expect(service.publishTask(task.id, {})).rejects.toThrow();
    await expect(service.updateTask(task.id, { confirmedFields: ["successCriteria"] })).rejects.toMatchObject({ code: "EMPTY_CONFIRMATION" });
    await expect(service.updateTask(task.id, { score: 100 })).rejects.toThrow();
    await expect(service.createTask({ ...draft, status: "published" })).rejects.toThrow();
    await expect(service.createTask({ initialDescription: "short" })).rejects.toThrow();
  });
  it("filters catalogue by status/theme/readiness and sorts descending", async () => {
    const catalogue = await service.listTasks();
    expect(catalogue.total).toBe(4);
    expect(catalogue.tasks.map((task) => task.score)).toEqual([100, 80, 40, 20]);
    expect((await service.listTasks({ status: "all" })).total).toBe(5);
    expect((await service.listTasks({ readinessLevel: "draft" })).tasks[0].id).toBe("task-4");
    expect((await service.listTasks({ topic: "аналитика", industry: "ритейл", q: "ПЕКАРНЯ" })).total).toBe(1);
    expect((await service.listTasks({ status: "draft" })).tasks[0].id).toBe("task-5");
  });
  it("enforces task state and foreign keys", async () => {
    await expect(service.createProposal("task-5", proposal)).rejects.toMatchObject({ code: "TASK_NOT_PUBLISHED" });
    await expect(service.createProposal("missing", proposal)).rejects.toMatchObject({ status: 404 });
    await expect(service.createProposal("task-1", { ...proposal, teamId: "missing" })).rejects.toMatchObject({ status: 404 });
    await expect(service.createProposal("task-1", { ...proposal, prototypeUrl: "javascript:alert(1)" })).rejects.toThrow();
    await service.archiveTask("task-1", {});
    await expect(service.createProposal("task-1", proposal)).rejects.toMatchObject({ status: 409 });
    await expect(service.updateTask("task-1", { title: "Change" })).rejects.toMatchObject({ code: "TASK_ARCHIVED" });
    await expect(service.publishTask("task-1", { confirmed: true })).rejects.toMatchObject({ code: "TASK_ARCHIVED" });
    await expect(service.decideProposal("proposal-1", { status: "accepted" })).rejects.toMatchObject({ status: 409 });
  });
  it("creates team profiles and resolves missing records", async () => {
    const { team } = await service.createTeam({ name: "New team", interests: ["AI"], skills: ["Backend"], technologies: ["Node.js"] });
    expect((await service.getTeam(team.id)).team.name).toBe("New team");
    expect((await service.listTeams()).total).toBe(6);
    await expect(service.getTeam("missing")).rejects.toMatchObject({ status: 404 });
    await expect(service.getTask("missing")).rejects.toMatchObject({ status: 404 });
    await expect(service.listProposals({}, "missing")).rejects.toMatchObject({ status: 404 });
    await expect(service.decideProposal("missing", { status: "accepted" })).rejects.toMatchObject({ status: 404 });
  });
});
