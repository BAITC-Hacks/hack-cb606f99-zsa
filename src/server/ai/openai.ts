import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { TaskFieldSchema, type AnalyzeDraftRequest } from "../../shared/contracts";
import { AI_SYSTEM_PROMPT, CARD_PROMPT, QUESTIONS_PROMPT } from "./prompts";
import type { AiProvider, CardInput } from "./provider";

// Keep wire schemas simple; stricter limits and grounding are checked by AiService.
const AnalysisOutput = z.object({
  questions: z.array(z.object({ id: z.string(), field: TaskFieldSchema, question: z.string(), reason: z.string() })),
  missingFields: z.array(TaskFieldSchema),
});
const CardOutput = z.object({
  title: z.string(), initialDescription: z.string(), industry: z.string(), topic: z.string(),
  contextAndNeed: z.string(), dataAndMaterials: z.string(), expectedResult: z.string(),
  successCriteria: z.string(), constraints: z.string(), targetUsers: z.string(),
  businessContact: z.string(), interactionFormat: z.string(),
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
    if (response.status !== "completed" || !response.output_parsed) throw new Error("AI_INCOMPLETE_RESPONSE");
    return schema.parse(response.output_parsed);
  }

  analyze(input: AnalyzeDraftRequest) {
    return this.generate(AnalysisOutput, "task_questions", QUESTIONS_PROMPT, input);
  }
  buildCard(input: CardInput) {
    return this.generate(CardOutput, "task_card", CARD_PROMPT, input);
  }
}
