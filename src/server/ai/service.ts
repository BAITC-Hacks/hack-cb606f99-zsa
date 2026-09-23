import {
  AnalysisSchema, AnalyzeDraftRequestSchema, BuildCardRequestSchema, ClarifyingQuestionSchema, TaskCardFieldsSchema, TASK_FIELDS, emptyTaskFields,
  type AiMetadata, type AnalyzeDraftResponse, type BuildCardResponse, type TaskCardFields, type TaskField,
} from "../../shared/contracts";
import { AppError } from "../errors";
import { MockAiProvider } from "./mock";
import { AiOutputError, safeAiDiagnostic } from "./errors";
import { sourceQuote } from "./grounding";
import { explicitResultQuote } from "./result-quote";
import { relevantQuestions } from "./questions";
import { FIELD_LABELS } from "./fields";
import { z } from "zod";
import type { AiProvider, CardInput } from "./provider";

const CandidateAnalysisSchema = AnalysisSchema.extend({ questions: z.array(ClarifyingQuestionSchema).max(12) });

function validateCard(input: CardInput, result: unknown): { card: TaskCardFields; rejectedFields: TaskField[] } {
  const card = TaskCardFieldsSchema.parse(result);
  const sources = [input.initialDescription, ...Object.values(input.fields ?? {}), ...input.answers.map((answer) => answer.answer)];
  // Explicit user edits and answers always win over model output.
  Object.assign(card, input.fields);
  for (const { field, answer } of input.answers) card[field] = answer;
  card.initialDescription = input.initialDescription;
  const rejectedFields: TaskField[] = [];
  for (const field of Object.keys(card) as TaskField[]) {
    if (!card[field]) continue;
    const quote = sourceQuote(card[field], sources);
    if (quote === undefined) rejectedFields.push(field);
    card[field] = quote ?? "";
  }
  // Recover an explicit desired artifact if the model omitted it or paraphrased
  // it into an ungrounded value. Do not infer a deliverable from a general goal,
  // and never override a user edit (including an intentionally empty field).
  if (!card.expectedResult && input.fields?.expectedResult === undefined &&
      !input.answers.some((answer) => answer.field === "expectedResult")) {
    const quote = explicitResultQuote(input.initialDescription);
    if (quote) {
      card.expectedResult = quote;
      const rejectedIndex = rejectedFields.indexOf("expectedResult");
      if (rejectedIndex !== -1) rejectedFields.splice(rejectedIndex, 1);
    }
  }
  // Preserve the source problem if extraction omitted it, without inventing a summary.
  // An explicitly cleared user field is still respected.
  if (!card.contextAndNeed && input.fields?.contextAndNeed === undefined &&
      !input.answers.some((answer) => answer.field === "contextAndNeed")) {
    card.contextAndNeed = input.initialDescription.slice(0, 5000);
  }
  if (!card.title && input.fields?.title === undefined && !input.answers.some((answer) => answer.field === "title")) {
    const source = card.expectedResult || card.contextAndNeed || input.initialDescription;
    card.title = source.split(/[.!?](?:\s|$)/u)[0].slice(0, 200).trim();
    if (!card.title) card.title = input.initialDescription.slice(0, 200);
  }
  return { card: TaskCardFieldsSchema.parse(card), rejectedFields };
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
        warning: this.mode === "mock" ? "Деморежим: ответ подготовлен по локальному шаблону." : null,
      } };
    } catch (error) {
      console.warn("AI request failed", safeAiDiagnostic(error));
      if (this.mode === "mock" || !this.allowFallback) {
        throw new AppError(502, "AI_UNAVAILABLE", "Не удалось подготовить ответ. Попробуйте позже или заполните карточку вручную.");
      }
      return { result: await operation(this.mock), ai: {
        provider: "mock", fallback: true,
        warning: "Не удалось подготовить ответ. Использован локальный шаблон; проверьте карточку вручную.",
      } };
    }
  }

  async analyze(value: unknown): Promise<AnalyzeDraftResponse> {
    const input = AnalyzeDraftRequestSchema.parse(value);
    const { result, ai } = await this.run(async (provider) => {
      const generated = await provider.analyze(input);
      const analysis = CandidateAnalysisSchema.parse(generated);
      if (new Set(analysis.questions.map((question) => question.id)).size !== analysis.questions.length ||
          new Set(analysis.questions.map((question) => question.question.toLocaleLowerCase("ru"))).size !== analysis.questions.length) {
        throw new AiOutputError("DUPLICATE_QUESTIONS");
      }
      const { card } = validateCard({ ...input, answers: [] }, generated.knownFields ?? emptyTaskFields(input.initialDescription));
      const missingFields = TASK_FIELDS.filter((field) => !card[field]);
      return AnalysisSchema.parse({ questions: relevantQuestions(analysis.questions, card, missingFields), missingFields });
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
    if (result.rejectedFields.length) {
      const warning = `Предложения для полей ${result.rejectedFields.map((field) => FIELD_LABELS[field]).join(", ")} не подтверждены исходным текстом и не использованы. Проверьте эти поля вручную.`;
      ai.warning = ai.warning ? `${ai.warning} ${warning}` : warning;
    }
    return { card: result.card, confirmedFields: [], ai };
  }
}
