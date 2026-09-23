import { describe, expect, it, vi } from "vitest";
import { AnalyzeDraftResponseSchema, BuildCardResponseSchema, TaskCardFieldsSchema, emptyTaskFields } from "../../shared/contracts";
import { MockAiProvider } from "./mock";
import { AiService } from "./service";
import { createSeed } from "../repositories/seed";
import type { AiProvider } from "./provider";

const input = { initialDescription: "Пекарня хочет сократить ежедневные списания продукции" };

describe("AI pipeline", () => {
  it("returns at least three contextual questions and transparently labels mock", async () => {
    const ai = new AiService(new MockAiProvider(), "mock");
    const result = await ai.analyze(input);
    expect(AnalyzeDraftResponseSchema.safeParse(result).success).toBe(true);
    expect(result.questions.length).toBeGreaterThanOrEqual(3);
    expect(result.questions[0].question).toContain("Пекарня");
    expect(result.ai).toMatchObject({ provider: "mock", fallback: false });
    const fields = TaskCardFieldsSchema.omit({ initialDescription: true }).parse(createSeed().tasks[0]);
    expect((await ai.analyze({ ...input, fields })).questions).toHaveLength(3);
  });
  it("builds an unconfirmed card from user answers without inventing unavailable facts", async () => {
    const ai = new AiService(new MockAiProvider(), "mock");
    const result = await ai.buildCard({ ...input, answers: [
      { field: "dataAndMaterials", answer: "CSV за 6 месяцев" },
      { field: "businessContact", answer: "owner@example.com" },
    ] });
    expect(BuildCardResponseSchema.safeParse(result).success).toBe(true);
    expect(result.card.dataAndMaterials).toBe("CSV за 6 месяцев");
    expect(result.card.successCriteria).toBe("");
    expect(result.card.constraints).toBe("");
    expect(result.confirmedFields).toEqual([]);
  });
  it("validates input before calling the provider", async () => {
    const provider = new MockAiProvider();
    const spy = vi.spyOn(provider, "buildCard");
    const ai = new AiService(provider, "openai");
    await expect(ai.buildCard({ ...input, answers: [{ field: "title", answer: "x".repeat(201) }] })).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });
  it("falls back on provider errors, while discarding unsupported facts with a warning", async () => {
    const provider = new MockAiProvider();
    vi.spyOn(provider, "analyze").mockRejectedValue(new Error("secret-api-key"));
    const ai = new AiService(provider, "openai");
    const result = await ai.analyze(input);
    expect(result.ai).toMatchObject({ provider: "mock", fallback: true });
    expect(JSON.stringify(result)).not.toContain("secret-api-key");
    vi.spyOn(provider, "buildCard").mockResolvedValue({ ...emptyTaskFields(input.initialDescription), businessContact: "invented@example.com" });
    const card = await ai.buildCard(input);
    expect(card.ai).toMatchObject({ provider: "openai", fallback: false });
    expect(card.ai.warning).toContain("Контакт бизнеса");
    expect(card.card.businessContact).toBe("");
    vi.spyOn(provider, "analyze").mockResolvedValue({ questions: undefined as never, missingFields: [] });
    expect((await ai.analyze(input)).ai.fallback).toBe(true);
  });
  it("can disable fallback and report a controlled upstream failure", async () => {
    const provider = new MockAiProvider();
    vi.spyOn(provider, "buildCard").mockRejectedValue(new Error("Timeout"));
    await expect(new AiService(provider, "openai", false).buildCard(input)).rejects.toMatchObject({ status: 502, code: "AI_UNAVAILABLE" });
  });
  it("keeps explicit edits over grounded model suggestions", async () => {
    const provider = new MockAiProvider();
    vi.spyOn(provider, "buildCard").mockResolvedValue({ ...emptyTaskFields(input.initialDescription), title: "Пекарня" });
    const result = await new AiService(provider, "openai").buildCard({ ...input, fields: { title: "Моя задача" } });
    expect(result.card.title).toBe("Моя задача");
    expect(result.ai.provider).toBe("openai");
  });
  it("preserves the stated problem when extraction omits context, without confirming it", async () => {
    const provider = new MockAiProvider();
    vi.spyOn(provider, "buildCard").mockResolvedValue(emptyTaskFields(input.initialDescription));
    const ai = new AiService(provider, "openai", false);
    const result = await ai.buildCard(input);
    expect(result.card.contextAndNeed).toBe(input.initialDescription);
    expect(result.confirmedFields).toEqual([]);
    expect(result.ai).toMatchObject({ provider: "openai", fallback: false });
    const cleared = await ai.buildCard({ ...input, fields: { contextAndNeed: "" } });
    expect(cleared.card.contextAndNeed).toBe("");
  });
  it("recovers original quotes when the model changes capitalization or final punctuation", async () => {
    const description = "Родители ищут кружки. Есть таблица с адресами.";
    const provider = new MockAiProvider();
    vi.spyOn(provider, "buildCard").mockResolvedValue({
      ...emptyTaskFields(description), targetUsers: "родители.", dataAndMaterials: "Таблица с адресами",
    });
    const result = await new AiService(provider, "openai", false).buildCard({ initialDescription: description });
    expect(result.card.targetUsers).toBe("Родители");
    expect(result.card.dataAndMaterials).toBe("таблица с адресами");
    expect(result.ai.warning).toBeNull();
  });
  it("keeps valid fields even when another suggestion invents a budget", async () => {
    const provider = new MockAiProvider();
    vi.spyOn(provider, "buildCard").mockResolvedValue({
      ...emptyTaskFields(input.initialDescription), title: "Пекарня", constraints: "Бюджет 500000 тенге",
    });
    const result = await new AiService(provider, "openai", false).buildCard(input);
    expect(result.card.title).toBe("Пекарня");
    expect(result.card.constraints).toBe("");
    expect(result.ai.warning).toContain("Ограничения");
    expect(JSON.stringify(result)).not.toContain("500000");
    expect(result.confirmedFields).toEqual([]);
  });
  it("recovers a requested result verbatim instead of accepting an ungrounded paraphrase", async () => {
    const description = "На ферме график полива ведут в бумажной тетради. Агроном хочет видеть запланированные и выполненные поливы на общей доске. Исторической цифровой базы нет.";
    const provider = new MockAiProvider();
    vi.spyOn(provider, "buildCard").mockResolvedValue({
      ...emptyTaskFields(description), expectedResult: "Общая доска планируемых и выполненных поливов",
      dataAndMaterials: "Исторической цифровой базы нет.", constraints: "Бюджет 500000 тенге",
    });
    const ai = new AiService(provider, "openai", false);
    const result = await ai.buildCard({ initialDescription: description });
    expect(result.card.expectedResult).toBe("Агроном хочет видеть запланированные и выполненные поливы на общей доске.");
    expect(result.card.dataAndMaterials).toBe("Исторической цифровой базы нет.");
    expect(result.card.constraints).toBe("");
    expect(result.ai.warning).toContain("Ограничения");
    expect(result.ai.warning).not.toContain("Ожидаемый результат");
    expect(result.confirmedFields).toEqual([]);
    expect((await ai.buildCard({ initialDescription: description, fields: { expectedResult: "" } })).card.expectedResult).toBe("");
    expect((await ai.buildCard({ initialDescription: description, answers: [{ field: "expectedResult", answer: "Итоговый отчёт вместо доски." }] })).card.expectedResult).toBe("Итоговый отчёт вместо доски.");
  });
  it.each([
    "Нам не нужна панель и мы не планируем создавать каталог. Хотим сначала изучить проблему.",
    "Если получим финансирование, нужен прототип приложения. Решение ещё не принято.",
    "Каждый вечер остаётся выпечка. Хотим уменьшить списания.",
  ])("does not invent a result when the provider leaves an ambiguous request empty: %s", async (description) => {
    const provider = new MockAiProvider();
    const result = await new AiService(provider, "openai", false).buildCard({ initialDescription: description });
    expect(result.card.expectedResult).toBe("");
    expect(result.card.constraints).toBe("");
  });
  it.each([
    ["Нам не нужен каталог. Выбранный результат ещё обсуждается.", "expectedResult", "нужен каталог", ""],
    ["Нужен каталог. Позже от этой идеи отказались.", "expectedResult", "Нужен каталог", ""],
    ["Есть CSV? Нет, данные ещё не собраны.", "dataAndMaterials", "Есть CSV", "Нет, данные ещё не собраны."],
    ["Есть CSV. CSV нет.", "dataAndMaterials", "Есть CSV. CSV нет.", ""],
    ["Срок 2 недели. Новый срок 4 недели.", "constraints", "Срок 2 недели", ""],
  ] as const)("does not publish unsafe model facts from %s", async (description, field, suggestion, expected) => {
    const upstream = new MockAiProvider();
    vi.spyOn(upstream, "buildCard").mockResolvedValue({ ...emptyTaskFields(description), [field]: suggestion });
    const result = await new AiService(upstream, "openai", false).buildCard({ initialDescription: description });
    expect(result.card[field]).toBe(expected);
    if (!expected) expect(result.ai.warning).toContain("неоднозначны");
    expect(result.confirmedFields).toEqual([]);
  });
  it("retains field-specific explicit answers and clearing despite contradictory source text", async () => {
    const description = "Нам не нужен каталог. CSV нет. Срок 2 недели.";
    const upstream = new MockAiProvider();
    vi.spyOn(upstream, "buildCard").mockResolvedValue({ ...emptyTaskFields(description), expectedResult: "нужен каталог" });
    const ai = new AiService(upstream, "openai", false);
    const result = await ai.buildCard({ initialDescription: description, fields: { expectedResult: "", constraints: "Срок 4 недели" }, answers: [
      { field: "dataAndMaterials", answer: "Теперь есть CSV за 6 месяцев." },
      { field: "constraints", answer: "Последнее решение: срок 5 недель." },
    ] });
    expect(result.card.expectedResult).toBe("");
    expect(result.card.dataAndMaterials).toBe("Теперь есть CSV за 6 месяцев.");
    expect(result.card.constraints).toBe("Последнее решение: срок 5 недель.");
    expect(result.ai.warning).toBeNull();
  });
  it("does not reuse an unrelated manual answer as evidence for another field", async () => {
    const upstream = new MockAiProvider();
    vi.spyOn(upstream, "buildCard").mockResolvedValue({ ...emptyTaskFields(input.initialDescription), expectedResult: "owner@example.com" });
    const result = await new AiService(upstream, "openai", false).buildCard({ ...input, answers: [{ field: "businessContact", answer: "owner@example.com" }] });
    expect(result.card.businessContact).toBe("owner@example.com");
    expect(result.card.expectedResult).toBe("");
  });
  it("does not truncate a long source into a misleading context statement", async () => {
    const description = `${"Контекст ".repeat(650)}. Данных нет.`;
    const upstream = new MockAiProvider();
    vi.spyOn(upstream, "buildCard").mockResolvedValue(emptyTaskFields(description));
    const result = await new AiService(upstream, "openai", false).buildCard({ initialDescription: description });
    expect(result.card.initialDescription).toBe(description);
    expect(result.card.contextAndNeed).toBe("");
    expect(result.card.title).toBe("");
  });
  it("keeps absence of data when the model omits it or shortens it into an ungrounded paraphrase", async () => {
    const description = "Пекарня теряет деньги на списаниях. Мы не хотим панель и не планируем создавать каталог. Формат результата ещё не выбран. Данных пока нет.";
    for (const dataAndMaterials of ["", "Данных нет"]) {
      const upstream = new MockAiProvider();
      vi.spyOn(upstream, "buildCard").mockResolvedValue({ ...emptyTaskFields(description), dataAndMaterials });
      const ai = new AiService(upstream, "openai", false);
      expect((await ai.buildCard({ initialDescription: description })).card.dataAndMaterials).toBe("Данных пока нет.");
      expect((await ai.buildCard({ initialDescription: description, fields: { dataAndMaterials: "" } })).card.dataAndMaterials).toBe("");
    }
  });
  it("rejects the business-goal response seen in the live question-is-not-data regression", async () => {
    const description = "Есть CSV? Ответ: данных нет. Нам не нужен каталог. Итоговый формат ещё обсуждается. Нужно сократить время обработки заявок.";
    const upstream: AiProvider = new MockAiProvider();
    const card = { ...emptyTaskFields(description), expectedResult: "сократить время обработки заявок", dataAndMaterials: "данных нет" };
    vi.spyOn(upstream, "buildCard").mockResolvedValue(card);
    vi.spyOn(upstream, "analyze").mockResolvedValue({ knownFields: card, questions: [], missingFields: [] });
    const ai = new AiService(upstream, "openai", false);
    const result = await ai.buildCard({ initialDescription: description });
    expect(result.card.expectedResult).toBe("");
    expect(result.card.dataAndMaterials).toContain("нет");
    const analysis = await ai.analyze({ initialDescription: description });
    expect(analysis.missingFields).toContain("expectedResult");
    expect(analysis.questions.some((question) => question.field === "expectedResult")).toBe(true);
  });
  it("recovers the original English deliverable while rejecting conditional data and translated guesses", async () => {
    const description = "Customers call to ask about repair progress. We need a status page. If access is granted, CSV is available. Access approval is still pending.";
    const upstream: AiProvider = new MockAiProvider();
    const card = { ...emptyTaskFields(description), expectedResult: "Страница статуса", dataAndMaterials: "CSV is available" };
    vi.spyOn(upstream, "buildCard").mockResolvedValue(card);
    vi.spyOn(upstream, "analyze").mockResolvedValue({ knownFields: card, questions: [], missingFields: [] });
    const ai = new AiService(upstream, "openai", false);
    const result = await ai.buildCard({ initialDescription: description });
    expect(result.card.expectedResult).toBe("We need a status page.");
    expect(result.card.dataAndMaterials).toBe("");
    const analysis = await ai.analyze({ initialDescription: description });
    expect(analysis.missingFields).not.toContain("expectedResult");
    expect(analysis.missingFields).toContain("dataAndMaterials");
  });
  it("recovers an omitted labelled deadline in cards and analysis while respecting manual overrides", async () => {
    const description = "Нужна веб-страница статуса ремонта. Есть CSV заказов. Срок — 2 недели. Встречи по пятницам, обратная связь за 2 дня.";
    const upstream: AiProvider = new MockAiProvider();
    vi.spyOn(upstream, "buildCard").mockResolvedValue(emptyTaskFields(description));
    vi.spyOn(upstream, "analyze").mockResolvedValue({ knownFields: emptyTaskFields(description), questions: [], missingFields: [] });
    const ai = new AiService(upstream, "openai", false);
    expect((await ai.buildCard({ initialDescription: description })).card.constraints).toBe("Срок — 2 недели.");
    expect((await ai.analyze({ initialDescription: description })).missingFields).not.toContain("constraints");
    expect((await ai.buildCard({ initialDescription: description, fields: { constraints: "" } })).card.constraints).toBe("");
    expect((await ai.buildCard({ initialDescription: description, answers: [{ field: "constraints", answer: "Новый согласованный срок — 5 недель." }] })).card.constraints).toBe("Новый согласованный срок — 5 недель.");
  });
});
