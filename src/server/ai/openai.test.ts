import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyTaskFields } from "../../shared/contracts";

const { parse, construct } = vi.hoisted(() => ({ parse: vi.fn(), construct: vi.fn() }));
vi.mock("openai", () => ({ default: class {
  responses = { parse };
  constructor(options: unknown) { construct(options); }
} }));
import { OpenAiProvider } from "./openai";
import { AiService } from "./service";

const input = { initialDescription: "Нужно сократить списания в пекарне" };
beforeEach(() => { vi.clearAllMocks(); });

describe("OpenAI adapter", () => {
  it("uses structured output, configured model, timeout and non-stored requests", async () => {
    parse.mockResolvedValue({ status: "completed", output_parsed: emptyTaskFields(input.initialDescription) });
    const provider = new OpenAiProvider({ apiKey: "test-only-key", model: "configured-model", timeoutMs: 1000 });
    const response = await new AiService(provider, "openai").buildCard(input);
    expect(response.ai.provider).toBe("openai");
    expect(construct).toHaveBeenCalledWith({ apiKey: "test-only-key", timeout: 1000, maxRetries: 0 });
    expect(parse).toHaveBeenCalledWith(expect.objectContaining({
      model: "configured-model", store: false,
      text: { format: expect.objectContaining({ type: "json_schema", strict: true, name: "task_card" }) },
      input: [expect.objectContaining({ role: "system" }), { role: "user", content: JSON.stringify({ ...input, answers: [] }) }],
    }));
  });
  it.each([
    { status: "incomplete", output_parsed: null },
    { status: "completed", output_parsed: null },
    { status: "completed", output_parsed: { questions: [], missingFields: [] } },
  ])("handles truncated, refused or invalid responses: %j", async (output) => {
    parse.mockResolvedValue(output);
    const provider = new OpenAiProvider({ apiKey: "test-only-key", model: "configured-model", timeoutMs: 1000 });
    const result = await new AiService(provider, "openai").analyze(input);
    expect(result.ai).toMatchObject({ provider: "mock", fallback: true });
    expect(result.questions.length).toBeGreaterThanOrEqual(3);
  });
  it("extracts known facts, leaving neutral questions to the server without changing the public response", async () => {
    parse.mockResolvedValue({ status: "completed", output_parsed: {
      knownFields: { ...emptyTaskFields(input.initialDescription), contextAndNeed: input.initialDescription },
      questions: [],
    } });
    const provider = new OpenAiProvider({ apiKey: "test-only-key", model: "configured-model", timeoutMs: 1000 });
    const response = await new AiService(provider, "openai", false).analyze(input);
    expect(response.questions.length).toBeGreaterThanOrEqual(3);
    expect(response.missingFields).not.toContain("contextAndNeed");
    expect(response).not.toHaveProperty("knownFields");
    expect(parse).toHaveBeenCalledTimes(1);
    expect(parse.mock.calls[0][0].text.format.schema.properties).not.toHaveProperty("questions");
  });
});
