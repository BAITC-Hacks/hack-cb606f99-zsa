import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockService, DEMO_STORAGE_KEY } from "./mock-service";
import { EMPTY_FIELDS, scorePreview, levelFor, type FieldKey } from "./model";
import { DEMO_DESCRIPTION, DEMO_ANSWERS } from "./seeds";
import { CardViewFieldsSchema, parseResponse } from "./schemas";

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

describe("frontend demo flow", () => {
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
  it("awards progress only after manual acceptance and only once", async () => {
    const item = await resolve(
      mockService.submitProposal("demo-task", proposal),
    );
    await expect(
      resolve(mockService.confirmMilestone(item.id)),
    ).rejects.toThrow("Сначала выберите");
    await resolve(mockService.decideProposal(item.id, "accepted"));
    expect(
      (await resolve(mockService.listTeams())).find((team) => team.id === "zsa")
        ?.points,
    ).toBe(0);
    await resolve(mockService.confirmMilestone(item.id));
    await resolve(mockService.confirmMilestone(item.id));
    expect(
      (await resolve(mockService.listTeams())).find((team) => team.id === "zsa")
        ?.points,
    ).toBe(25);
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
