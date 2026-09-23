import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockService, DEMO_STORAGE_KEY } from "./mock-service";
import { EMPTY_FIELDS, scorePreview, levelFor, type FieldKey } from "./model";
import { DEMO_DESCRIPTION, DEMO_ANSWERS } from "./seeds";
import { CardViewFieldsSchema, parseResponse } from "./schemas";
import { ApiClientError } from "./service";

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function resolve<T>(operation: Promise<T>): Promise<T> {
  const wrapped = operation.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  await vi.runAllTimersAsync();
  const result = await wrapped;
  if ("error" in result) throw result.error;
  return result.value;
}
const proposal = {
  teamId: "zsa",
  solutionIdea: "Прототип меню",
  plan: "Интервью, прототип, проверка",
  estimatedDuration: "2 недели",
  prototypeUrl: "",
};

it("archives an unnamed draft without losing it from the business workspace", async () => {
  const task = await resolve(mockService.saveTask({
    fields: { ...EMPTY_FIELDS, initialDescription: "Нужен учёт заказов мастерской" },
    confirmedFields: [],
  }));
  expect(task.title).toBe("");
  const archived = await resolve(mockService.archiveTask(task.id, task.version));
  expect(archived.status).toBe("archived");
  expect((await resolve(mockService.listTasks(true))).some((item) => item.id === task.id)).toBe(true);
  expect((await resolve(mockService.listTasks())).some((item) => item.id === task.id)).toBe(false);
  await expect(resolve(mockService.saveTask({ fields: archived, confirmedFields: [], expectedVersion: archived.version }, archived.id))).rejects.toThrow("архиве");
  await expect(resolve(mockService.publishTask(archived.id, archived.version))).rejects.toThrow("архиве");
  expect((await resolve(mockService.archiveTask(task.id, archived.version))).version).toBe(archived.version);
});

describe("frontend demo flow", () => {
  it("returns typed version conflicts for offline save, publish and archive so the UI can recover", async () => {
    const task = await resolve(mockService.getTask("demo-task"));
    await resolve(mockService.saveTask({
      fields: { ...task, title: "Обновлено другой вкладкой" }, confirmedFields: ["title"], expectedVersion: task.version,
    }, task.id));
    for (const operation of [
      () => mockService.saveTask({ fields: task, confirmedFields: ["title"], expectedVersion: task.version }, task.id),
      () => mockService.publishTask(task.id, task.version),
      () => mockService.archiveTask(task.id, task.version),
    ]) {
      const error = await resolve(operation()).catch((err: unknown) => err);
      expect(error).toBeInstanceOf(ApiClientError);
      expect(error).toMatchObject({ code: "VERSION_CONFLICT" });
    }
    expect((await resolve(mockService.getTask(task.id))).title).toBe("Обновлено другой вкладкой");
    expect((await resolve(mockService.getTask(task.id))).status).toBe("published");
  });
  it("allows unnamed drafts but preserves the title of a published task", async () => {
    const draft = await resolve(mockService.saveTask({
      fields: { ...EMPTY_FIELDS, initialDescription: DEMO_DESCRIPTION }, confirmedFields: [],
    }));
    expect(draft.title).toBe("");
    const published = await resolve(mockService.getTask("demo-task"));
    await expect(resolve(mockService.saveTask({
      fields: { ...published, title: "   " }, confirmedFields: [], expectedVersion: published.version,
    }, published.id))).rejects.toThrow("должно быть название");
    expect((await resolve(mockService.getTask(published.id))).title).toBe(published.title);
  });
  it("respects known fields during analysis in offline mode", async () => {
    const analysis = await resolve(mockService.analyze(DEMO_DESCRIPTION, {
      industry: "Ритейл",
      expectedResult: "Экран очереди для бариста",
    }));
    expect(analysis.questions.some((question) => question.field === "industry")).toBe(false);
    expect(analysis.questions.some((question) => question.field === "expectedResult")).toBe(false);
    expect(analysis.missingFields).not.toContain("expectedResult");
    expect(analysis.questions.length).toBeGreaterThanOrEqual(3);
  });
  it("provides optional reviews when known fields cover all offline questions", async () => {
    const analysis = await resolve(mockService.analyze(DEMO_DESCRIPTION, {
      industry: "Ритейл",
      targetUsers: "Бариста",
      dataAndMaterials: "CSV меню",
      expectedResult: "Экран очереди",
      successCriteria: "Заказ виден сразу после оплаты",
      constraints: "Две недели",
      businessContact: "coffee@example.com",
      interactionFormat: "Созвон каждую пятницу",
    }));
    expect(analysis.missingFields).toEqual([]);
    expect(analysis.questions).toHaveLength(3);
    expect(analysis.questions.every((question) => question.question.startsWith("Проверка: уже указано"))).toBe(true);
  });
  it.each([undefined, "", "   "])("treats optional or blank known fields (%j) as missing", async (value) => {
    const analysis = await resolve(mockService.analyze(DEMO_DESCRIPTION, {
      industry: "Ритейл",
      targetUsers: value,
      dataAndMaterials: "CSV меню",
      expectedResult: value,
      successCriteria: "Заказ виден сразу после оплаты",
      constraints: "Две недели",
      businessContact: "coffee@example.com",
      interactionFormat: "Созвон каждую пятницу",
    }));
    expect(analysis.missingFields).toEqual(["targetUsers", "expectedResult"]);
    expect(analysis.questions).toHaveLength(3);
    expect(analysis.questions.slice(0, 2).map((question) => question.field)).toEqual([
      "targetUsers", "expectedResult",
    ]);
    expect(analysis.questions[2].question).toContain("Проверка: уже указано «CSV меню»");
  });

  it("keeps missing answers empty and never invents facts", async () => {
    const result = await resolve(
      mockService.generate({
        initialDescription: DEMO_DESCRIPTION,
        industry: "Ритейл",
        answers: {},
      }),
    );
    expect(result.card.contextAndNeed).toBe(DEMO_DESCRIPTION);
    expect(result.card.dataAndMaterials).toBe("");
    expect(result.card.businessContact).toBe("");
    expect(scorePreview(result.card, [])).toBe(0);
    expect(
      (await resolve(mockService.analyze(DEMO_DESCRIPTION))).questions.length,
    ).toBeGreaterThanOrEqual(3);
  });
  it("requires both confirmed contact and interaction format for communication points", () => {
    const fields = {
      ...EMPTY_FIELDS,
      businessContact: "business@example.com",
      interactionFormat: "Созвон раз в неделю",
    };
    expect(scorePreview(fields, ["businessContact"])).toBe(0);
    expect(scorePreview(fields, ["businessContact", "interactionFormat"])).toBe(
      10,
    );
    expect(
      scorePreview({ ...fields, interactionFormat: "  " }, [
        "businessContact",
        "interactionFormat",
      ]),
    ).toBe(0);
  });
  it("keeps level boundaries inclusive", () => {
    expect(
      [0, 39, 40, 69, 70, 89, 90, 100].map((score) => levelFor(score).key),
    ).toEqual([
      "draft",
      "draft",
      "workable",
      "workable",
      "ready",
      "ready",
      "priority",
      "priority",
    ]);
  });
  it("publishes low-score tasks and accepts multiple proposals without selecting them", async () => {
    const task = await resolve(
      mockService.saveTask({
        fields: {
          ...EMPTY_FIELDS,
          title: "Слабое описание",
          initialDescription: DEMO_DESCRIPTION,
        },
        confirmedFields: ["title"],
      }),
    );
    expect(
      (await resolve(mockService.listTasks())).some(
        (item) => item.id === task.id,
      ),
    ).toBe(false);
    expect(
      (await resolve(mockService.listTasks(true))).some(
        (item) => item.id === task.id,
      ),
    ).toBe(true);
    await expect(
      resolve(mockService.submitProposal(task.id, proposal)),
    ).rejects.toThrow("после публикации");
    await resolve(mockService.publishTask(task.id));
    const first = await resolve(mockService.submitProposal(task.id, proposal));
    const second = await resolve(
      mockService.submitProposal(task.id, { ...proposal, teamId: "orbit" }),
    );
    expect(first.status).toBe("pending");
    expect(second.status).toBe("pending");
    await resolve(mockService.decideProposal(first.id, "accepted"));
    await resolve(mockService.decideProposal(second.id, "accepted"));
    expect(
      (await resolve(mockService.listProposals(task.id))).filter(
        (item) => item.status === "accepted",
      ),
    ).toHaveLength(2);
    expect(
      (await resolve(mockService.listTasks())).find(
        (item) => item.id === task.id,
      )?.score,
    ).toBe(0);
  });
  it("saves, edits, re-confirms and reloads a generated card without duplicating it", async () => {
    const { card: fields } = await resolve(
      mockService.generate({
        initialDescription: DEMO_DESCRIPTION,
        industry: "Ритейл",
        answers: DEMO_ANSWERS,
      }),
    );
    const confirmed = Object.keys(fields) as FieldKey[];
    const task = await resolve(
      mockService.saveTask({ fields, confirmedFields: confirmed }),
    );
    expect(task.score).toBe(100);
    const edited = await resolve(
      mockService.saveTask(
        {
          fields: { ...task, dataAndMaterials: "Новый файл CSV" },
          confirmedFields: confirmed.filter(
            (key) => key !== "dataAndMaterials",
          ),
        },
        task.id,
      ),
    );
    expect(edited.score).toBe(80);
    const updated = await resolve(
      mockService.saveTask(
        { fields: edited, confirmedFields: confirmed },
        task.id,
      ),
    );
    expect(updated.score).toBe(100);
    expect((await resolve(mockService.getTask(task.id))).dataAndMaterials).toBe(
      "Новый файл CSV",
    );
    expect(
      (await resolve(mockService.listTasks(true))).filter(
        (item) => item.id === task.id,
      ),
    ).toHaveLength(1);
  });
  it("awards progress only after a submitted report is confirmed, and only once", async () => {
    const item = await resolve(
      mockService.submitProposal("demo-task", proposal),
    );
    await expect(
      resolve(mockService.createMilestone(item.id, { title: "Прототип", description: "Проверить полный сценарий" })),
    ).rejects.toThrow("Сначала выберите");
    await resolve(mockService.decideProposal(item.id, "accepted"));
    expect(
      (await resolve(mockService.listTeams())).find((team) => team.id === "zsa")
        ?.points,
    ).toBe(0);
    const planned = await resolve(mockService.createMilestone(item.id, { title: "Прототип", description: "Проверить полный сценарий" }));
    await expect(resolve(mockService.reviewMilestone(planned.id, { decision: "confirm", expectedVersion: planned.version }))).rejects.toThrow("отправить отчёт");
    const submitted = await resolve(mockService.submitMilestone(planned.id, { report: "Прототип собран", expectedVersion: planned.version }));
    expect((await resolve(mockService.listTeams())).find((team) => team.id === "zsa")?.points).toBe(0);
    await expect(resolve(mockService.reviewMilestone(planned.id, { decision: "request_changes", expectedVersion: submitted.version }))).rejects.toThrow();
    const changes = await resolve(mockService.reviewMilestone(planned.id, { decision: "request_changes", comment: "Показать проверку", expectedVersion: submitted.version }));
    expect(changes.status).toBe("changes_requested");
    await expect(resolve(mockService.submitMilestone(planned.id, { report: "Несвежий отчёт", expectedVersion: planned.version }))).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    const resubmitted = await resolve(mockService.submitMilestone(planned.id, { report: "Проверка добавлена", evidenceUrl: "https://example.com/evidence", expectedVersion: changes.version }));
    expect(resubmitted.reviewComment).toBe("");
    await resolve(mockService.reviewMilestone(planned.id, { decision: "confirm", expectedVersion: resubmitted.version }));
    await resolve(mockService.reviewMilestone(planned.id, { decision: "confirm", expectedVersion: resubmitted.version }));
    expect(
      (await resolve(mockService.listTeams())).find((team) => team.id === "zsa")
        ?.points,
    ).toBe(10);
    await expect(resolve(mockService.submitMilestone(planned.id, { report: "Переписать подтверждённое", expectedVersion: resubmitted.version + 1 }))).rejects.toThrow();
  });
  it("preserves legacy awards as history without inventing a submitted report or new points", async () => {
    const proposal = await resolve(mockService.submitProposal("demo-task", { teamId: "zsa", solutionIdea: "Идея", plan: "План", estimatedDuration: "Неделя", prototypeUrl: "" }));
    const stored = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY)!);
    const legacy = { proposalId: proposal.id, points: 25, confirmedAt: "2026-09-23T08:00:00.000Z" };
    stored.milestones = [legacy];
    stored.teams.find((team: { id: string }) => team.id === "zsa").points = 25;
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(stored));
    expect(await resolve(mockService.listMilestones("demo-task"))).toEqual([]);
    expect((await resolve(mockService.listTeams())).find((team) => team.id === "zsa")?.points).toBe(0);
    await resolve(mockService.decideProposal(proposal.id, "accepted"));
    await resolve(mockService.createMilestone(proposal.id, { title: "Новый этап", description: "Новый проверяемый результат" }));
    const migrated = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY)!);
    expect(migrated.legacyMilestones).toEqual([legacy]);
    expect(migrated.teams.find((team: { id: string }) => team.id === "zsa").points).toBe(25);
    expect(migrated.proposals.some((item: { id: string }) => item.id === proposal.id)).toBe(true);
  });
  it("rejects executable milestone evidence URLs", async () => {
    const item = await resolve(mockService.submitProposal("demo-task", proposal));
    await resolve(mockService.decideProposal(item.id, "accepted"));
    const planned = await resolve(mockService.createMilestone(item.id, { title: "Проверка", description: "Проверить результат" }));
    await expect(resolve(mockService.submitMilestone(planned.id, { report: "Готово", evidenceUrl: "javascript:alert(1)", expectedVersion: planned.version }))).rejects.toThrow();
  });
  it("keeps milestone history and points after archive while rejecting every later milestone mutation", async () => {
    const item = await resolve(mockService.submitProposal("demo-task", proposal));
    await resolve(mockService.decideProposal(item.id, "accepted", "Команда выбрана"));
    const first = await resolve(mockService.createMilestone(item.id, { title: "Прототип", description: "Показать результат" }));
    const submitted = await resolve(mockService.submitMilestone(first.id, { report: "Сценарий работает", expectedVersion: first.version }));
    const confirmed = await resolve(mockService.reviewMilestone(first.id, { decision: "confirm", expectedVersion: submitted.version }));
    const planned = await resolve(mockService.createMilestone(item.id, { title: "Дальнейшая проверка", description: "Проверить ещё один сценарий" }));
    const task = await resolve(mockService.getTask("demo-task"));
    const archived = await resolve(mockService.archiveTask(task.id, task.version));
    expect((await resolve(mockService.archiveTask(task.id, archived.version))).version).toBe(archived.version);
    expect(await resolve(mockService.listMilestones(task.id))).toEqual([confirmed, planned]);
    expect((await resolve(mockService.listTeams())).find((team) => team.id === "zsa")?.points).toBe(10);
    for (const operation of [
      () => mockService.createMilestone(item.id, { title: "Нельзя", description: "Архив недоступен для записи" }),
      () => mockService.submitMilestone(planned.id, { report: "Нельзя", expectedVersion: planned.version }),
      () => mockService.reviewMilestone(confirmed.id, { decision: "confirm", expectedVersion: confirmed.version }),
      () => mockService.decideProposal(item.id, "rejected"),
    ]) {
      await expect(resolve<unknown>(operation())).rejects.toMatchObject({ code: "TASK_NOT_PUBLISHED" });
    }
    await expect(resolve(mockService.saveTask({ fields: task, confirmedFields: [], expectedVersion: archived.version }, task.id))).rejects.toMatchObject({ code: "TASK_ARCHIVED" });
    await expect(resolve(mockService.publishTask(task.id, archived.version))).rejects.toMatchObject({ code: "TASK_ARCHIVED" });
    expect(await resolve(mockService.listMilestones(task.id))).toEqual([confirmed, planned]);
  });
  it("reports corrupt data and invalid AI output, preserving stored content", async () => {
    localStorage.setItem(DEMO_STORAGE_KEY, "broken-json");
    await expect(resolve(mockService.listTasks())).rejects.toThrow(
      "повреждены",
    );
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBe("broken-json");
    expect(() =>
      parseResponse(CardViewFieldsSchema, { title: "Incomplete" }),
    ).toThrow("неподдерживаемом формате");
  });
  it("rejects executable prototype URLs", async () => {
    await expect(
      resolve(
        mockService.submitProposal("demo-task", {
          ...proposal,
          prototypeUrl: "javascript:alert(1)",
        }),
      ),
    ).rejects.toThrow("https://");
  });
});
