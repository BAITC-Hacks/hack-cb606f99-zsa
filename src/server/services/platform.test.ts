import { beforeEach, describe, expect, it } from "vitest";
import {
  TASK_FIELDS, TaskCardFieldsSchema, TaskResponseSchema, ProposalResponseSchema, TeamResponseSchema,
  CreateMilestoneRequestSchema, SubmitMilestoneRequestSchema, ReviewMilestoneRequestSchema,
  MilestoneSchema, MilestoneResponseSchema, MilestoneListResponseSchema,
} from "../../shared/contracts";
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

const milestoneInput = { title: "Прототип панели", description: "Показать импорт CSV и график остатков на пяти тестовых заказах." };
const submissionInput = { report: "Импорт CSV и график готовы, проверены на пяти заказах.", evidenceUrl: "https://example.com/prototype" };

describe("milestone progress and confirmed team points", () => {
  it("supports multiple stages, changes requested and only awards confirmed progress", async () => {
    const taskBefore = (await service.getTask("task-1")).task;
    const { milestone: planned } = await service.createMilestone("proposal-1", milestoneInput);
    expect(MilestoneResponseSchema.safeParse({ milestone: planned }).success).toBe(true);
    expect(planned).toMatchObject({
      proposalId: "proposal-1", taskId: "task-1", teamId: "team-1", status: "planned", points: 10,
      version: 1, report: "", evidenceUrl: "", submittedAt: null, confirmedAt: null,
    });
    expect((await service.getTeam("team-1")).team.points).toBe(0);

    const { milestone: submitted } = await service.submitMilestone(planned.id, {
      report: submissionInput.report, expectedVersion: planned.version,
    });
    expect(submitted).toMatchObject({ status: "submitted", version: 2, evidenceUrl: "", confirmedAt: null });
    expect(submitted.submittedAt).not.toBeNull();
    expect((await service.getTeam("team-1")).team.points).toBe(0);

    const { milestone: changes } = await service.reviewMilestone(planned.id, {
      decision: "request_changes", comment: "Покажите обработку пустого CSV.", expectedVersion: submitted.version,
    });
    expect(changes).toMatchObject({ status: "changes_requested", version: 3, reviewComment: "Покажите обработку пустого CSV.", confirmedAt: null });
    expect((await service.getTeam("team-1")).team.points).toBe(0);
    const { milestone: resubmitted } = await service.submitMilestone(planned.id, {
      ...submissionInput, report: "Добавлена обработка пустого CSV.", expectedVersion: changes.version,
    });
    expect(resubmitted).toMatchObject({ status: "submitted", version: 4, reviewComment: "", evidenceUrl: submissionInput.evidenceUrl });
    const { milestone: confirmed } = await service.reviewMilestone(planned.id, {
      decision: "confirm", comment: "Проверено на демонстрации.", expectedVersion: resubmitted.version,
    });
    expect(confirmed).toMatchObject({ status: "confirmed", version: 5, reviewComment: "Проверено на демонстрации." });
    expect(confirmed.confirmedAt).not.toBeNull();
    expect((await service.getTeam("team-1")).team.points).toBe(10);

    const { milestone: second } = await service.createMilestone("proposal-1", { ...milestoneInput, title: "Проверка с бизнесом" });
    const { milestone: secondSubmitted } = await service.submitMilestone(second.id, { ...submissionInput, expectedVersion: second.version });
    await service.reviewMilestone(second.id, { decision: "confirm", expectedVersion: secondSubmitted.version });
    const team = await service.getTeam("team-1");
    expect(TeamResponseSchema.safeParse(team).success).toBe(true);
    expect(team.team.points).toBe(20);
    expect((await service.listTeams()).teams.find((item) => item.id === "team-1")?.points).toBe(20);
    expect((await service.getTeam("team-2")).team.points).toBe(0);
    const listed = await service.listMilestones("task-1");
    expect(listed.total).toBe(2);
    expect(MilestoneListResponseSchema.safeParse(listed).success).toBe(true);
    expect((await service.listMilestones("task-2")).total).toBe(0);
    // Team progress is independent of the task's completeness score/version.
    expect((await service.getTask("task-1")).task).toEqual(taskBefore);
  });

  it("checks versions and states and makes repeat confirmation an immutable no-op", async () => {
    const { milestone } = await service.createMilestone("proposal-1", milestoneInput);
    await expect(service.reviewMilestone(milestone.id, { decision: "confirm", expectedVersion: 1 }))
      .rejects.toMatchObject({ code: "MILESTONE_STATE_CONFLICT" });
    await service.submitMilestone(milestone.id, { ...submissionInput, expectedVersion: 1 });
    await expect(service.submitMilestone(milestone.id, { ...submissionInput, expectedVersion: 1 }))
      .rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    await expect(service.submitMilestone(milestone.id, { ...submissionInput, expectedVersion: 2 }))
      .rejects.toMatchObject({ code: "MILESTONE_STATE_CONFLICT" });
    await expect(service.reviewMilestone(milestone.id, { decision: "confirm", expectedVersion: 1 }))
      .rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    const confirmed = await service.reviewMilestone(milestone.id, { decision: "confirm", comment: "Принято", expectedVersion: 2 });
    expect(await service.reviewMilestone(milestone.id, { decision: "confirm", comment: "Не перезаписывать", expectedVersion: 2 })).toEqual(confirmed);
    expect(await service.reviewMilestone(milestone.id, { decision: "confirm", expectedVersion: 3 })).toEqual(confirmed);
    await expect(service.reviewMilestone(milestone.id, { decision: "request_changes", comment: "Изменить", expectedVersion: 3 }))
      .rejects.toMatchObject({ code: "MILESTONE_STATE_CONFLICT" });
    await expect(service.submitMilestone(milestone.id, { ...submissionInput, expectedVersion: 3 }))
      .rejects.toMatchObject({ code: "MILESTONE_STATE_CONFLICT" });
    expect((await service.listMilestones("task-1")).milestones[0]).toEqual(confirmed.milestone);
    expect((await service.getTeam("team-1")).team.points).toBe(10);
  });

  it("never awards twice for concurrent confirmations", async () => {
    const { milestone } = await service.createMilestone("proposal-1", milestoneInput);
    await service.submitMilestone(milestone.id, { ...submissionInput, expectedVersion: 1 });
    const results = await Promise.all(Array.from({ length: 4 }, () =>
      service.reviewMilestone(milestone.id, { decision: "confirm", expectedVersion: 2 }),
    ));
    expect(results.every((item) => item.milestone.version === 3)).toBe(true);
    expect((await service.getTeam("team-1")).team.points).toBe(10);
    expect((await service.listMilestones("task-1")).total).toBe(1);
  });

  it("requires an accepted proposal and published task, while retaining confirmed history", async () => {
    await expect(service.createMilestone("proposal-2", milestoneInput)).rejects.toMatchObject({ code: "PROPOSAL_NOT_ACCEPTED" });
    await expect(service.createMilestone("proposal-3", milestoneInput)).rejects.toMatchObject({ code: "PROPOSAL_NOT_ACCEPTED" });
    const { milestone } = await service.createMilestone("proposal-1", milestoneInput);
    const { milestone: pending } = await service.createMilestone("proposal-1", { ...milestoneInput, title: "Следующий этап" });
    await service.submitMilestone(milestone.id, { ...submissionInput, expectedVersion: 1 });
    await service.reviewMilestone(milestone.id, { decision: "confirm", expectedVersion: 2 });
    await service.decideProposal("proposal-1", { status: "rejected" });
    await expect(service.createMilestone("proposal-1", milestoneInput)).rejects.toMatchObject({ code: "PROPOSAL_NOT_ACCEPTED" });
    await expect(service.submitMilestone(pending.id, { ...submissionInput, expectedVersion: 1 })).rejects.toMatchObject({ code: "PROPOSAL_NOT_ACCEPTED" });
    await expect(service.reviewMilestone(milestone.id, { decision: "confirm", expectedVersion: 2 })).rejects.toMatchObject({ code: "PROPOSAL_NOT_ACCEPTED" });
    expect((await service.getTeam("team-1")).team.points).toBe(10);
    expect((await service.listMilestones("task-1")).total).toBe(2);

    await service.decideProposal("proposal-1", { status: "accepted" });
    await service.archiveTask("task-1", {});
    await expect(service.createMilestone("proposal-1", milestoneInput)).rejects.toMatchObject({ code: "TASK_NOT_PUBLISHED" });
    await expect(service.submitMilestone(pending.id, { ...submissionInput, expectedVersion: 1 })).rejects.toMatchObject({ code: "TASK_NOT_PUBLISHED" });
    await expect(service.reviewMilestone(milestone.id, { decision: "confirm", expectedVersion: 3 })).rejects.toMatchObject({ code: "TASK_NOT_PUBLISHED" });
    expect((await service.listMilestones("task-1")).milestones.find((item) => item.id === milestone.id)?.status).toBe("confirmed");
    expect((await service.getTeam("team-1")).team.points).toBe(10);
  });

  it("reports missing resources and ignores any stored team balance", async () => {
    await expect(service.listMilestones("missing")).rejects.toMatchObject({ status: 404 });
    await expect(service.createMilestone("missing", milestoneInput)).rejects.toMatchObject({ status: 404 });
    await expect(service.submitMilestone("missing", { ...submissionInput, expectedVersion: 1 })).rejects.toMatchObject({ status: 404 });
    await expect(service.reviewMilestone("missing", { decision: "confirm", expectedVersion: 1 })).rejects.toMatchObject({ status: 404 });
    const repository = new MemoryRepository();
    Object.assign(repository.data.teams[0], { points: 9000 });
    const projected = new PlatformService(repository);
    expect((await projected.getTeam("team-1")).team.points).toBe(0);
    expect((await projected.listTeams()).teams[0].points).toBe(0);
    const created = await projected.createTeam({ name: "No progress yet", interests: ["AI"], skills: ["Backend"], technologies: ["Node.js"] });
    expect(created.team.points).toBe(0);
    await expect(projected.createTeam({ name: "Cheat", interests: ["AI"], skills: ["Backend"], technologies: ["Node.js"], points: 100 }))
      .rejects.toThrow();
  });

  it("validates required fields, versions, HTTP(S) evidence and server-owned state", async () => {
    expect(CreateMilestoneRequestSchema.safeParse(milestoneInput).success).toBe(true);
    for (const input of [{ ...milestoneInput, title: " " }, { ...milestoneInput, description: "" }, { ...milestoneInput, points: 100 }, { ...milestoneInput, status: "confirmed" }]) {
      expect(CreateMilestoneRequestSchema.safeParse(input).success).toBe(false);
    }
    expect(SubmitMilestoneRequestSchema.parse({ report: " Report ", expectedVersion: 1 })).toEqual({ report: "Report", evidenceUrl: "", expectedVersion: 1 });
    for (const input of [{ report: " " , expectedVersion: 1 }, { report: "Report" }, { report: "Report", expectedVersion: 0 },
      { report: "Report", expectedVersion: 1, evidenceUrl: "javascript:alert(1)" },
      { report: "Report", expectedVersion: 1, evidenceUrl: "ftp://example.com/report" },
      { report: "Report", expectedVersion: 1, points: 100 }]) {
      expect(SubmitMilestoneRequestSchema.safeParse(input).success).toBe(false);
    }
    expect(ReviewMilestoneRequestSchema.parse({ decision: "confirm", expectedVersion: 2 }).comment).toBe("");
    for (const input of [{ decision: "confirm" }, { decision: "request_changes", expectedVersion: 2 },
      { decision: "request_changes", comment: " ", expectedVersion: 2 },
      { decision: "confirm", expectedVersion: 2, points: 100 }, { decision: "accepted", expectedVersion: 2 }]) {
      expect(ReviewMilestoneRequestSchema.safeParse(input).success).toBe(false);
    }
    const { milestone } = await service.createMilestone("proposal-1", milestoneInput);
    expect(MilestoneSchema.safeParse({ ...milestone, points: 999 }).success).toBe(false);
    expect(MilestoneSchema.safeParse({ ...milestone, status: "submitted" }).success).toBe(false);
    expect(MilestoneSchema.safeParse({ ...milestone, report: "Not submitted yet" }).success).toBe(false);
    expect(MilestoneSchema.safeParse({ ...milestone, confirmedAt: new Date().toISOString() }).success).toBe(false);
    const submitted = { ...milestone, status: "submitted", report: "Done", submittedAt: new Date().toISOString() };
    expect(MilestoneSchema.safeParse(submitted).success).toBe(true);
    expect(MilestoneSchema.safeParse({ ...submitted, status: "confirmed" }).success).toBe(false);
    expect(MilestoneSchema.safeParse({ ...submitted, status: "changes_requested" }).success).toBe(false);
  });
});
