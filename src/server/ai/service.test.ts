import { describe, expect, it, vi } from "vitest";
import { AnalyzeDraftResponseSchema, BuildCardResponseSchema, TaskCardFieldsSchema, emptyTaskFields } from "../../shared/contracts";
import { MockAiProvider } from "./mock";
import { AiService } from "./service";
import { createSeed } from "../repositories/seed";

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
  it("falls back on unavailable, refused and malformed output without leaking secrets", async () => {
    const provider = new MockAiProvider();
    vi.spyOn(provider, "analyze").mockRejectedValue(new Error("secret-api-key"));
    const ai = new AiService(provider, "openai");
    const result = await ai.analyze(input);
    expect(result.ai).toMatchObject({ provider: "mock", fallback: true });
    expect(JSON.stringify(result)).not.toContain("secret-api-key");
    vi.spyOn(provider, "buildCard").mockResolvedValue({ ...emptyTaskFields(input.initialDescription), businessContact: "invented@example.com" });
    const card = await ai.buildCard(input);
    expect(card.ai.fallback).toBe(true);
    expect(card.card.businessContact).toBe("");
    vi.spyOn(provider, "analyze").mockResolvedValue({ questions: [], missingFields: [] });
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
});
