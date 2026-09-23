import { describe, expect, it } from "vitest";
import { explicitConstraintQuote, explicitDataAbsenceQuote, sourceQuote } from "./grounding";

describe("source quotes", () => {
  it("returns the original spelling and spacing", () => {
    expect(sourceQuote("таблица с адресами.", ["Есть Таблица  с адресами"])).toBe("Таблица  с адресами");
  });
  it("does not interpret source text as regular expressions", () => {
    expect(sourceQuote("(a+b)*", ["Формула (a+b)* указана."])).toBe("(a+b)*");
    expect(sourceQuote("a.b", ["axb"])).toBeUndefined();
  });
  it("rejects paraphrases and invented values", () => {
    expect(sourceQuote("Сумма 500000 тенге", ["Бюджет не определён"])).toBeUndefined();
    expect(sourceQuote("Родители детей", ["Родители ищут кружки"])).toBeUndefined();
    expect(sourceQuote("...", ["Ничего не указано"])).toBeUndefined();
  });
  it.each([
    ["нужен каталог", ["Нам не нужен каталог."]],
    ["Есть CSV", ["Есть CSV? Нет, данные ещё не собраны."]],
    ["CSV", ["Если получим доступ, будет CSV."]],
    ["цифровой базы", ["Исторической цифровой базы нет."]],
    ["need a catalog", ["We do not need a catalog."]],
    ["CSV is available", ["If access is granted, CSV is available."]],
    ["historical data", ["No historical data."]],
    ["Есть CSV", ["Есть CSV.", "CSV нет."]],
    ["Есть CSV", ["Есть CSV. CSV нет."]],
    ["Срок 2 недели", ["Срок 2 недели. Новый срок 4 недели."]],
  ])("rejects lost qualifiers or conflicting context: %s", (value, sources) => {
    expect(sourceQuote(value, sources)).toBeUndefined();
  });
  it.each([
    ["Исторической цифровой базы нет.", "Исторической цифровой базы нет."],
    ["Бюджет не согласован", "Бюджет не согласован."],
    ["No historical data", "No historical data."],
    ["CSV за 6 месяцев", "Есть CSV за 6 месяцев. Контакт — demo@example.com."],
  ])("preserves complete negative facts and ordinary positive quotes: %s", (value, source) => {
    expect(sourceQuote(value, [source])).toBe(value);
  });
  it("does not revive a cancelled result, even when the cancellation uses a pronoun", () => {
    expect(sourceQuote("Нужен каталог", ["Нужен каталог. Позже от этой идеи отказались."], "expectedResult")).toBeUndefined();
    expect(sourceQuote("We need a catalog", ["We need a catalog. That idea was cancelled."], "expectedResult")).toBeUndefined();
    expect(sourceQuote("Нам не нужен каталог", ["Нам не нужен каталог."], "expectedResult")).toBeUndefined();
  });
  it("keeps a stated user role in a problem statement but rejects an excluded role", () => {
    expect(sourceQuote("Родители", ["Родители не могут найти кружок."], "targetUsers")).toBe("Родители");
    expect(sourceQuote("Родители", ["Родители не будут пользоваться системой."], "targetUsers")).toBeUndefined();
  });
  it("does not confuse a negative problem statement with denial of an available resource", () => {
    expect(sourceQuote("Есть таблица кружков", ["Родители не могут найти кружки. Есть таблица кружков."], "dataAndMaterials")).toBe("Есть таблица кружков");
  });
  it("requires word boundaries instead of extracting a positive word from a negative one", () => {
    expect(sourceQuote("доступна", ["База недоступна."])).toBeUndefined();
    expect(sourceQuote("available", ["Data is unavailable."])).toBeUndefined();
  });
  it.each([
    "сократить время обработки заявок",
    "уменьшить списания",
    "повысить скорость обслуживания",
    "reduce processing time",
    "improve customer satisfaction",
  ])("does not mistake a general business objective for a concrete deliverable: %s", (goal) => {
    expect(sourceQuote(goal, [`Хотим ${goal}.`], "expectedResult")).toBeUndefined();
  });
  it.each([
    "Прототип должен уменьшить время обработки заявок",
    "алгоритм оптимизации маршрута",
    "исследование способов снизить расходы",
    "research on how to reduce expenses",
  ])("retains a concrete deliverable that also states its goal: %s", (value) => {
    expect(sourceQuote(value, [`${value}.`], "expectedResult")).toBe(value);
  });
  it("recovers only unambiguous complete absence statements", () => {
    expect(explicitDataAbsenceQuote("Заявки теряются. Данных пока нет.")).toBe("Данных пока нет.");
    expect(explicitDataAbsenceQuote("Historical data is missing. No CSV data.")).toBe("No CSV data.");
    expect(explicitDataAbsenceQuote("Есть CSV. CSV нет.")).toBeUndefined();
    expect(explicitDataAbsenceQuote("Если данных нет, будем собирать их позже.")).toBeUndefined();
    expect(explicitDataAbsenceQuote("Данных нет?")).toBeUndefined();
  });
  it.each([
    ["Нужна панель. Срок — 2 недели. Встречи по пятницам, обратная связь за 2 дня.", "Срок — 2 недели."],
    ["Бюджет проекта: 100000 тенге.", "Бюджет проекта: 100000 тенге."],
    ["Ограничения — без персональных данных.", "Ограничения — без персональных данных."],
    ["Project deadline: 4 weeks.", "Project deadline: 4 weeks."],
  ])("recovers an explicit project constraint without losing its source wording: %s", (description, expected) => {
    expect(explicitConstraintQuote(description)).toBe(expected);
  });
  it.each([
    "Срок обратной связи — 2 дня.",
    "Срок ответа: 2 дня.",
    "Response deadline: 2 days.",
    "Срок: ответ представителя за 2 дня.",
    "Срок — возможно 2 недели.",
    "Срок — 2 или 3 недели.",
    "Срок — 2 недели?",
    "Срок — 2 недели. Позже от этого отказались.",
    "Срок — 2 недели. Срок — 4 недели.",
    "Срок — 2 недели. Бюджет — 100000 тенге.",
  ])("does not guess a project constraint from communication, ambiguity or cancellation: %s", (description) => {
    expect(explicitConstraintQuote(description)).toBeUndefined();
  });
});
