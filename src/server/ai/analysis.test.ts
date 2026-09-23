import { describe, expect, it, vi } from "vitest";
import { emptyTaskFields, type TaskCardFields } from "../../shared/contracts";
import type { AiProvider } from "./provider";
import { AiService } from "./service";

const initialDescription = "Клиенты хотят страницу статуса ремонта. Есть CSV заказов.";
function provider(knownFields: TaskCardFields): AiProvider {
  return {
    async analyze() { return { knownFields, missingFields: ["expectedResult", "dataAndMaterials", "targetUsers"], questions: [
      { id: "1", field: "expectedResult", question: "Что нужно сделать?", reason: "Результат" },
      { id: "2", field: "dataAndMaterials", question: "Какие данные есть?", reason: "Данные" },
      { id: "3", field: "targetUsers", question: "Кто пользователи?", reason: "Пользователи" },
    ] }; },
    async buildCard() { return knownFields; },
  };
}
describe("analysis reconciles model suggestions with source facts", () => {
  it("computes gaps from grounded facts, ignoring the model's contradictory gap list", async () => {
    const known = { ...emptyTaskFields(initialDescription), expectedResult: "страницу статуса ремонта", dataAndMaterials: "CSV заказов", targetUsers: "Клиенты" };
    const result = await new AiService(provider(known), "openai", false).analyze({ initialDescription });
    for (const field of ["expectedResult", "dataAndMaterials", "targetUsers", "contextAndNeed"] as const) {
      expect(result.missingFields).not.toContain(field);
      expect(result.questions.some((question) => question.field === field)).toBe(false);
    }
    expect(result.missingFields).toContain("successCriteria");
  });
  it("does not let invented known fields hide gaps and respects an explicit user deletion", async () => {
    const known = { ...emptyTaskFields(initialDescription), businessContact: "invented@example.com", targetUsers: "Клиенты" };
    const result = await new AiService(provider(known), "openai", false).analyze({ initialDescription, fields: { targetUsers: "" } });
    expect(result.missingFields).toContain("businessContact");
    expect(result.missingFields).toContain("targetUsers");
    expect(result.questions.map((question) => question.field)).toContain("businessContact");
  });
  it("fills a short model question list to the public minimum instead of returning 502", async () => {
    const mock = provider(emptyTaskFields(initialDescription));
    vi.spyOn(mock, "analyze").mockResolvedValue({ knownFields: emptyTaskFields(initialDescription), questions: [], missingFields: [] });
    const result = await new AiService(mock, "openai", false).analyze({ initialDescription });
    expect(result.questions.length).toBeGreaterThanOrEqual(3);
    expect(result.ai.provider).toBe("openai");
  });
});
