import {
  AnalysisSchema, AnalyzeDraftRequestSchema, BuildCardRequestSchema, ClarifyingQuestionSchema, TaskCardFieldsSchema, TASK_FIELDS, emptyTaskFields,
  type AiMetadata, type AnalyzeDraftResponse, type BuildCardResponse, type TaskCardFields, type TaskField,
} from "../../shared/contracts";
import { AppError } from "../errors";
import { MockAiProvider } from "./mock";
import { AiOutputError, safeAiDiagnostic } from "./errors";
import { explicitConstraintQuote, explicitDataAbsenceQuote, sourceQuote } from "./grounding";
import { explicitResultQuote } from "./result-quote";
import { relevantQuestions } from "./questions";
import { FIELD_LABELS } from "./fields";
import { z } from "zod";
import type { AiProvider, CardInput } from "./provider";

const CandidateAnalysisSchema = AnalysisSchema.extend({ questions: z.array(ClarifyingQuestionSchema).max(12) });

function validateCard(input: CardInput, result: unknown): { card: TaskCardFields; rejectedFields: TaskField[] } {
  const card = TaskCardFieldsSchema.parse(result);
  // A manual value is authoritative only for its own field. Do not let the model
  // reuse an unrelated answer as evidence for a different inferred fact.
  const explicit = new Set<TaskField>(["initialDescription", ...Object.keys(input.fields ?? {}) as TaskField[], ...input.answers.map((answer) => answer.field)]);
  // Explicit user edits and answers always win over model output.
  Object.assign(card, input.fields);
  for (const { field, answer } of input.answers) card[field] = answer;
  card.initialDescription = input.initialDescription;
  const rejectedFields: TaskField[] = [];
  for (const field of Object.keys(card) as TaskField[]) {
    if (!card[field] || explicit.has(field)) continue;
    const quote = sourceQuote(card[field], [input.initialDescription], field);
    if (quote === undefined) rejectedFields.push(field);
    card[field] = quote ?? "";
  }
  // Recover an explicit desired artifact if the model omitted it or paraphrased
  // it into an ungrounded value. Do not infer a deliverable from a general goal,
  // and never override a user edit (including an intentionally empty field).
  if (!card.expectedResult && input.fields?.expectedResult === undefined &&
      !input.answers.some((answer) => answer.field === "expectedResult")) {
    const candidate = explicitResultQuote(input.initialDescription);
    const quote = candidate ? sourceQuote(candidate, [input.initialDescription], "expectedResult") : undefined;
    if (quote) {
      card.expectedResult = quote;
      const rejectedIndex = rejectedFields.indexOf("expectedResult");
      if (rejectedIndex !== -1) rejectedFields.splice(rejectedIndex, 1);
    }
  }
  if (!card.dataAndMaterials && !explicit.has("dataAndMaterials")) {
    const quote = explicitDataAbsenceQuote(input.initialDescription);
    if (quote) {
      card.dataAndMaterials = quote;
      const rejectedIndex = rejectedFields.indexOf("dataAndMaterials");
      if (rejectedIndex !== -1) rejectedFields.splice(rejectedIndex, 1);
    }
  }
  if (!card.constraints && !explicit.has("constraints")) {
    const quote = explicitConstraintQuote(input.initialDescription);
    if (quote) {
      card.constraints = quote;
      const rejectedIndex = rejectedFields.indexOf("constraints");
      if (rejectedIndex !== -1) rejectedFields.splice(rejectedIndex, 1);
    }
  }
  // Preserve the source problem if extraction omitted it, without inventing a summary.
  // An explicitly cleared user field is still respected.
  if (!card.contextAndNeed && input.fields?.contextAndNeed === undefined &&
      !input.answers.some((answer) => answer.field === "contextAndNeed")) {
    // Do not truncate a long sentence before a negation/correction at the limit.
    card.contextAndNeed = input.initialDescription.length <= 5000 ? input.initialDescription : "";
  }
  if (!card.title && input.fields?.title === undefined && !input.answers.some((answer) => answer.field === "title")) {
    const source = card.expectedResult || card.contextAndNeed || input.initialDescription;
    const sentence = source.split(/[.!?](?:\s|$)/u)[0].trim();
    // A shorter manual title is safer than truncating before a crucial qualifier.
    card.title = sentence.length <= 200 ? sentence : "";
  }
  return { card: TaskCardFieldsSchema.parse(card), rejectedFields };
}

function addGroundingWarning(ai: AiMetadata, rejectedFields: TaskField[]) {
  if (!rejectedFields.length) return;
  const warning = `Предложения AI для полей ${rejectedFields.map((field) => FIELD_LABELS[field]).join(", ")} не подтверждены исходным текстом с учётом контекста или неоднозначны и не использованы. Уточните эти поля вручную.`;
  ai.warning = ai.warning ? `${ai.warning} ${warning}` : warning;
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
      const { card, rejectedFields } = validateCard({ ...input, answers: [] }, generated.knownFields ?? emptyTaskFields(input.initialDescription));
      const missingFields = TASK_FIELDS.filter((field) => !card[field]);
      return { analysis: AnalysisSchema.parse({ questions: relevantQuestions(card, missingFields), missingFields }), rejectedFields };
    });
    addGroundingWarning(ai, result.rejectedFields);
    return { ...result.analysis, ai };
  }

  async buildCard(value: unknown): Promise<BuildCardResponse> {
    const input = BuildCardRequestSchema.parse(value);
    // Validate field-specific answer limits before invoking a paid provider.
    const supplied = { ...input.fields };
    for (const { field, answer } of input.answers) supplied[field] = answer;
    TaskCardFieldsSchema.partial().parse(supplied);
    const { result, ai } = await this.run(async (provider) => validateCard(input, await provider.buildCard(input)));
    addGroundingWarning(ai, result.rejectedFields);
    return { card: result.card, confirmedFields: [], ai };
  }
}
