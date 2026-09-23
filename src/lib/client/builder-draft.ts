import type { AnalyzeDraftResponse, TaskCardFields } from "@/shared/contracts";
import { EMPTY_FIELDS, type FieldKey } from "./model";

export type BuilderDraft = {
  description: string;
  industry: string;
  questions: AnalyzeDraftResponse["questions"];
  answers: Partial<Record<FieldKey, string>>;
  analysisInvalidated: boolean;
};

type DraftAction =
  | { type: "source"; description?: string; industry?: string }
  | { type: "analysis"; questions: BuilderDraft["questions"] }
  | { type: "answer"; field: FieldKey; value: string }
  | { type: "answers"; answers: BuilderDraft["answers"] };

// Questions and answers belong to one source revision, never to another task.
export function builderDraftReducer(draft: BuilderDraft, action: DraftAction): BuilderDraft {
  switch (action.type) {
    case "source": {
      const description = action.description ?? draft.description;
      const industry = action.industry ?? draft.industry;
      if (description === draft.description && industry === draft.industry) return draft;
      return {
        description,
        industry,
        questions: [],
        answers: {},
        analysisInvalidated: draft.analysisInvalidated || draft.questions.length > 0 ||
          Object.values(draft.answers).some((answer) => Boolean(answer?.trim())),
      };
    }
    case "analysis":
      return { ...draft, questions: action.questions, analysisInvalidated: false };
    case "answer":
      return { ...draft, answers: { ...draft.answers, [action.field]: action.value } };
    case "answers":
      return { ...draft, answers: { ...action.answers } };
  }
}

export function manualCardFromDraft(draft: BuilderDraft): TaskCardFields {
  const description = draft.description.trim();
  const fields: TaskCardFields = {
    ...EMPTY_FIELDS,
    title: description.slice(0, 180),
    contextAndNeed: description,
    industry: draft.industry,
    initialDescription: description,
  };
  for (const key of Object.keys(EMPTY_FIELDS) as FieldKey[]) {
    const answer = draft.answers[key]?.trim();
    if (key !== "initialDescription" && answer) fields[key] = answer;
  }
  return fields;
}
