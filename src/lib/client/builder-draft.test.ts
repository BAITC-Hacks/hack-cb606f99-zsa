import { describe, expect, it } from "vitest";
import { builderDraftReducer, manualCardFromDraft, type BuilderDraft } from "./builder-draft";
import { TaskCardFieldsSchema } from "@/shared/contracts";

const coffee = (): BuilderDraft => ({
  description: "В кофейне большие очереди. Хотим улучшить обслуживание гостей.",
  industry: "Ритейл",
  questions: [{ id: "result", field: "expectedResult", question: "Какой нужен результат?", reason: "Объём работы" }],
  answers: { expectedResult: "Веб-прототип предзаказа кофе.", businessContact: "old-coffee@example.com" },
  analysisInvalidated: false,
});

describe("task builder source revisions and manual fallback", () => {
  it("invalidates hidden answers and questions when the source changes", () => {
    const changed = builderDraftReducer(coffee(), {
      type: "source", description: "Нужен каталог кружков для родителей.", industry: "Образование",
    });
    expect(changed.questions).toEqual([]);
    expect(changed.answers).toEqual({});
    expect(changed.analysisInvalidated).toBe(true);
    const regenerated = builderDraftReducer(changed, { type: "analysis", questions: [] });
    expect(regenerated.answers).toEqual({});
    expect(regenerated.analysisInvalidated).toBe(false);
    const manual = manualCardFromDraft(changed);
    expect(manual.expectedResult).toBe("");
    expect(manual.businessContact).toBe("");
    expect(manual.industry).toBe("Образование");
  });

  it("also invalidates answers on an industry-only change", () => {
    const result = builderDraftReducer(coffee(), { type: "source", industry: "Образование" });
    expect(result.answers).toEqual({});
    expect(result.analysisInvalidated).toBe(true);
  });

  it("preserves answers when returning to the source without editing it", () => {
    const original = coffee();
    expect(builderDraftReducer(original, { type: "source", description: original.description })).toBe(original);
    const reanalyzed = builderDraftReducer(original, { type: "analysis", questions: original.questions });
    expect(reanalyzed.answers).toEqual(original.answers);
  });

  it("retains the invalidation notice through subsequent keystrokes", () => {
    const changed = builderDraftReducer(coffee(), { type: "source", description: "Новая задача" });
    expect(builderDraftReducer(changed, { type: "source", description: "Новая задача." }).analysisInvalidated).toBe(true);
  });

  it("does not warn on the initial description before any analysis", () => {
    const empty = { ...coffee(), questions: [], answers: {} };
    expect(builderDraftReducer(empty, { type: "source", description: "Новое описание" }).analysisInvalidated).toBe(false);
  });

  it("copies all entered answers into a manual card after an AI failure", () => {
    const draft = builderDraftReducer(coffee(), { type: "answer", field: "dataAndMaterials", value: " CSV меню из 20 позиций. " });
    const fields = manualCardFromDraft(draft);
    expect(fields.expectedResult).toBe("Веб-прототип предзаказа кофе.");
    expect(fields.businessContact).toBe("old-coffee@example.com");
    expect(fields.dataAndMaterials).toBe("CSV меню из 20 позиций.");
    expect(fields.contextAndNeed).toBe(draft.description);
    expect(fields.initialDescription).toBe(draft.description);
    expect(fields.industry).toBe("Ритейл");
    expect(draft.answers.dataAndMaterials).toBe(" CSV меню из 20 позиций. ");
  });

  it("ignores blank answers and cannot overwrite the source with an answer", () => {
    const fields = manualCardFromDraft({ ...coffee(), answers: { title: " ", initialDescription: "Old source", industry: "" } });
    expect(fields.title).toBe(coffee().description);
    expect(fields.initialDescription).toBe(coffee().description);
    expect(fields.industry).toBe("Ритейл");
  });

  it("keeps the full API-length source while fitting derived manual fields", () => {
    const description = "Описание задачи ".repeat(700).slice(0, 10000).trim();
    const fields = manualCardFromDraft({ ...coffee(), description, answers: {} });
    expect(fields.initialDescription).toBe(description);
    expect(fields.title).toHaveLength(200);
    expect(fields.contextAndNeed).toHaveLength(5000);
    expect(TaskCardFieldsSchema.safeParse(fields).success).toBe(true);
  });
});
