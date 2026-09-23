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
  it("does not repeat a known requested result when the model paraphrases or omits it", async () => {
    const description = "На ферме график полива ведут в бумажной тетради. Агроном хочет видеть запланированные и выполненные поливы на общей доске. Исторической цифровой базы нет.";
    for (const suggestion of ["", "Общая доска планируемых и выполненных поливов"]) {
      const known = { ...emptyTaskFields(description), expectedResult: suggestion, dataAndMaterials: "Исторической цифровой базы нет." };
      const result = await new AiService(provider(known), "openai", false).analyze({ initialDescription: description });
      expect(result.missingFields).not.toContain("expectedResult");
      expect(result.questions.some((question) => question.field === "expectedResult")).toBe(false);
      expect(result.missingFields).not.toContain("dataAndMaterials");
      expect(result.missingFields).toContain("successCriteria");
    }
  });
  it.each([
    ["Посетители не могут найти свободный зал. Нужен каталог залов.", "Посетители не могут найти свободный зал."],
    ["Директор заказал систему для операторов. Они будут обрабатывать заявки.", "операторов"],
  ])("accepts a user role or its complete source sentence without requiring a label: %s", async (description, targetUsers) => {
    const known = { ...emptyTaskFields(description), targetUsers };
    const result = await new AiService(provider(known), "openai", false).analyze({ initialDescription: description });
    expect(result.missingFields).not.toContain("targetUsers");
    expect(result.questions.some((question) => question.field === "targetUsers")).toBe(false);
  });
  it("continues rejecting invented qualifications instead of loosely matching a user role", async () => {
    const description = "Клиенты ищут доставку для семьи. Нужен каталог услуг доставки.";
    const known = { ...emptyTaskFields(description), targetUsers: "Клиенты с семьями" };
    const result = await new AiService(provider(known), "openai", false).analyze({ initialDescription: description });
    expect(result.missingFields).toContain("targetUsers");
  });
  it("asks neutral clarifications for unsafe values, ignoring assumptions inside model questions", async () => {
    const description = "Нам не нужен каталог. Есть CSV? Доступ ещё обсуждается.";
    const known = { ...emptyTaskFields(description), expectedResult: "нужен каталог", dataAndMaterials: "Есть CSV" };
    const upstream = provider(known);
    vi.spyOn(upstream, "analyze").mockResolvedValue({ knownFields: known, missingFields: [], questions: [
      { id: "1", field: "constraints", question: "Как потратите согласованные 500000 тенге за 2 недели?", reason: "Бюджет уже известен" },
      { id: "2", field: "dataAndMaterials", question: "Пришлите обещанный CSV", reason: "CSV существует" },
      { id: "3", field: "expectedResult", question: "Какой каталог сделаем?", reason: "Каталог выбран" },
    ] });
    const result = await new AiService(upstream, "openai", false).analyze({ initialDescription: description });
    expect(result.missingFields).toEqual(expect.arrayContaining(["expectedResult", "dataAndMaterials"]));
    expect(result.questions.map((question) => question.field)).toEqual(expect.arrayContaining(["expectedResult", "dataAndMaterials"]));
    const text = result.questions.map((question) => `${question.question} ${question.reason}`).join(" ");
    expect(text).not.toContain("500000");
    expect(text).not.toContain("обещанный CSV");
    expect(text).not.toContain("Каталог выбран");
    expect(result.ai.warning).toContain("неоднозначны");
  });
});
