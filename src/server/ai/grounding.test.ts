import { describe, expect, it } from "vitest";
import { sourceQuote } from "./grounding";

describe("source quotes", () => {
  it("returns the original spelling and spacing", () => {
    expect(sourceQuote("таблица с адресами.", ["Есть Таблица  с адресами"])).toBe("Таблица  с адресами");
  });
  it("does not interpret source text as regular expressions", () => {
    expect(sourceQuote("(a+b)?.", ["Формула (a+b)? указана."])).toBe("(a+b)");
    expect(sourceQuote("a.b", ["axb"])).toBeUndefined();
  });
  it("rejects paraphrases and invented values", () => {
    expect(sourceQuote("Сумма 500000 тенге", ["Бюджет не определён"])).toBeUndefined();
    expect(sourceQuote("Родители детей", ["Родители ищут кружки"])).toBeUndefined();
    expect(sourceQuote("...", ["Ничего не указано"])).toBeUndefined();
  });
});
