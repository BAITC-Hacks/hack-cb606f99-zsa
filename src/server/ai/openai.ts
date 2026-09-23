import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { type AnalyzeDraftRequest } from "../../shared/contracts";
import { AI_SYSTEM_PROMPT, CARD_PROMPT, QUESTIONS_PROMPT } from "./prompts";
import type { AiProvider, CardInput } from "./provider";
import { AiOutputError } from "./errors";
import { ExtractedFieldsSchema } from "./fields";

// Keep wire schemas simple; stricter limits and grounding are checked by AiService.
const AnalysisOutput = z.object({
  knownFields: ExtractedFieldsSchema.describe("Сначала извлеки все явно известные сведения из initialDescription и fields."),
});

export class OpenAiProvider implements AiProvider {
  private readonly client: OpenAI;
  constructor(private readonly options: { apiKey: string; model: string; timeoutMs: number }) {
    this.client = new OpenAI({ apiKey: options.apiKey, timeout: options.timeoutMs, maxRetries: 0 });
  }

  private async generate<T extends z.ZodType>(schema: T, name: string, prompt: string, input: unknown): Promise<z.output<T>> {
    const response = await this.client.responses.parse({
      model: this.options.model,
      store: false,
      max_output_tokens: 5000,
      input: [
        { role: "system", content: `${AI_SYSTEM_PROMPT}\n${prompt}` },
        { role: "user", content: JSON.stringify(input) },
      ],
      text: { format: zodTextFormat(schema, name) },
    });
    if (response.status !== "completed" || !response.output_parsed) throw new AiOutputError("INCOMPLETE_RESPONSE");
    return schema.parse(response.output_parsed);
  }

  async analyze(input: AnalyzeDraftRequest) {
    const result = await this.generate(AnalysisOutput, "task_questions", QUESTIONS_PROMPT, input);
    return { questions: [], missingFields: [], knownFields: {
      ...result.knownFields, initialDescription: input.initialDescription,
    } };
  }
  async buildCard(input: CardInput) {
    const fields = await this.generate(ExtractedFieldsSchema, "task_card", CARD_PROMPT, input);
    return { ...fields, initialDescription: input.initialDescription };
  }
}
