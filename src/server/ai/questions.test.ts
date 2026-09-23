import { describe, expect, it } from "vitest";
import { AnalysisSchema, TASK_FIELDS, emptyTaskFields, type TaskField } from "../../shared/contracts";
import { createSeed } from "../repositories/seed";
import { relevantQuestions } from "./questions";

describe("knowledge-aware questions", () => {
  it("removes questions about known values and covers unasked gaps", () => {
    const card = { ...emptyTaskFields("Нужна страница статуса ремонта для клиентов"), title: "Ремонт", contextAndNeed: "Клиенты звонят", expectedResult: "страница статуса", targetUsers: "клиенты" };
    const missing = TASK_FIELDS.filter((field) => !card[field]);
    const repeated = ["contextAndNeed", "expectedResult", "targetUsers"].map((field, index) => ({
      id: String(index), field: field as TaskField, question: "Повторите известное", reason: "Повтор",
    }));
    const questions = relevantQuestions(repeated, card, missing);
    expect(AnalysisSchema.safeParse({ questions, missingFields: missing }).success).toBe(true);
    expect(questions.every((item) => missing.includes(item.field))).toBe(true);
    expect(questions.map((item) => item.field)).toContain("businessContact");
    expect(questions.map((item) => item.field)).toContain("interactionFormat");
    expect(questions.map((item) => item.question).join(" ")).not.toContain("Повторите");
  });
  it("provides three optional reviews for a complete card, acknowledging existing facts", () => {
    const card = createSeed().tasks[0];
    const questions = relevantQuestions([], card, []);
    expect(questions).toHaveLength(3);
    for (const question of questions) {
      expect(question.question).toMatch(/^Проверка:/u);
      expect(question.question).toContain(card[question.field].slice(0, 200));
      expect(question.reason).toContain("можно пропустить");
    }
  });
  it("keeps a real gap as a clarification and supplements it with reviews", () => {
    const card = { ...createSeed().tasks[0], successCriteria: "" };
    const questions = relevantQuestions([], card, ["successCriteria"]);
    expect(questions).toHaveLength(3);
    expect(questions[0].field).toBe("successCriteria");
    expect(questions.slice(1).every((item) => item.question.startsWith("Проверка:"))).toBe(true);
    expect(new Set(questions.map((item) => item.id)).size).toBe(3);
  });
});
