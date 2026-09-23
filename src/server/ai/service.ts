import {
  AnalysisSchema, AnalyzeDraftRequestSchema, BuildCardRequestSchema, TaskCardFieldsSchema,
  type AiMetadata, type AnalyzeDraftResponse, type BuildCardResponse, type TaskCardFields,
} from "../../shared/contracts";
import { AppError } from "../errors";
import { MockAiProvider } from "./mock";
import type { AiProvider, CardInput } from "./provider";

function validateCard(input: CardInput, result: unknown): TaskCardFields {
  const card = TaskCardFieldsSchema.parse(result);
  const sources = [input.initialDescription, ...Object.values(input.fields ?? {}), ...input.answers.map((answer) => answer.answer)];
  for (const [field, value] of Object.entries(card)) {
    if (value && !sources.some((source) => source.includes(value))) throw new Error(`UNGROUNDED_FIELD:${field}`);
  }
  // Explicit user edits and answers always win over model output.
  Object.assign(card, input.fields);
  for (const { field, answer } of input.answers) card[field] = answer;
  card.initialDescription = input.initialDescription;
  return TaskCardFieldsSchema.parse(card);
}

export class AiService {
  private readonly mock = new MockAiProvider();
  constructor(
    private readonly provider: AiProvider,
    private readonly mode: "mock" | "openai",
    private readonly allowFallback = true,
  ) {}

  private async run<T>(operation: (provider: AiProvider) => Promise<T>): Promise<{ result: T; ai: AiMetadata }> {
    try {
      return { result: await operation(this.provider), ai: {
        provider: this.mode, fallback: false,
        warning: this.mode === "mock" ? "Деморежим: ответ подготовлен локальным шаблоном, без обращения к AI." : null,
      } };
    } catch {
      if (this.mode === "mock" || !this.allowFallback) {
        throw new AppError(502, "AI_UNAVAILABLE", "Не удалось получить корректный ответ AI. Попробуйте позже или заполните карточку вручную.");
      }
      return { result: await operation(this.mock), ai: {
        provider: "mock", fallback: true,
        warning: "AI недоступен или вернул некорректные данные. Использован локальный деморежим; проверьте карточку вручную.",
      } };
    }
  }

  async analyze(value: unknown): Promise<AnalyzeDraftResponse> {
    const input = AnalyzeDraftRequestSchema.parse(value);
    const { result, ai } = await this.run(async (provider) => {
      const analysis = AnalysisSchema.parse(await provider.analyze(input));
      if (new Set(analysis.questions.map((question) => question.id)).size !== analysis.questions.length ||
          new Set(analysis.questions.map((question) => question.question.toLocaleLowerCase("ru"))).size !== analysis.questions.length) {
        throw new Error("DUPLICATE_QUESTIONS");
      }
      return { ...analysis, missingFields: [...new Set(analysis.missingFields)] };
    });
    return { ...result, ai };
  }

  async buildCard(value: unknown): Promise<BuildCardResponse> {
    const input = BuildCardRequestSchema.parse(value);
    // Validate field-specific answer limits before invoking a paid provider.
    const supplied = { ...input.fields };
    for (const { field, answer } of input.answers) supplied[field] = answer;
    TaskCardFieldsSchema.partial().parse(supplied);
    const { result, ai } = await this.run(async (provider) => validateCard(input, await provider.buildCard(input)));
    return { card: result, confirmedFields: [], ai };
  }
}
