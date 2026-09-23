import type {
  TaskCard,
  TaskCardFields,
  Proposal,
  AnalyzeDraftRequest,
  AnalyzeDraftResponse,
  BuildCardResponse,
  Readiness,
} from "@/shared/contracts";
import { READINESS_LEVELS, SCORING_DIMENSIONS } from "@/shared/scoring";

export type FieldKey = keyof TaskCardFields;
export type Team = {
  id: string;
  name: string;
  skills: string[];
  interests: string[];
  technologies?: string[];
  points?: number;
};
export type ProposalInput = Pick<
  Proposal,
  "teamId" | "solutionIdea" | "plan" | "estimatedDuration" | "prototypeUrl"
>;
export type CardInput = {
  initialDescription: string;
  industry: string;
  answers: Partial<Record<FieldKey, string>>;
};
export type SaveInput = {
  fields: TaskCardFields;
  confirmedFields: FieldKey[];
  expectedVersion?: number;
};
export type Milestone = {
  proposalId: string;
  points: number;
  confirmedAt: string;
};
export type TaskService = {
  supportsMilestones: boolean;
  listTasks: (includeDrafts?: boolean) => Promise<TaskCard[]>;
  getTask: (id: string) => Promise<TaskCard>;
  analyze: (
    description: string,
    fields?: AnalyzeDraftRequest["fields"],
  ) => Promise<AnalyzeDraftResponse>;
  generate: (input: CardInput) => Promise<BuildCardResponse>;
  saveTask: (input: SaveInput, id?: string) => Promise<TaskCard>;
  publishTask: (id: string, expectedVersion?: number) => Promise<TaskCard>;
  archiveTask: (id: string, expectedVersion?: number) => Promise<TaskCard>;
  listTeams: () => Promise<Team[]>;
  listProposals: (taskId: string) => Promise<Proposal[]>;
  submitProposal: (taskId: string, input: ProposalInput) => Promise<Proposal>;
  decideProposal: (
    id: string,
    status: "accepted" | "rejected",
    decisionComment?: string,
  ) => Promise<Proposal>;
  listMilestones: (taskId: string) => Promise<Milestone[]>;
  confirmMilestone: (proposalId: string) => Promise<Milestone>;
};

export const FIELD_LABELS: Record<FieldKey, string> = {
  title: "Название задачи",
  initialDescription: "Исходное описание",
  industry: "Отрасль",
  topic: "Тема",
  contextAndNeed: "Контекст и потребность",
  dataAndMaterials: "Данные и материалы",
  expectedResult: "Ожидаемый результат",
  successCriteria: "Критерии успеха",
  constraints: "Ограничения",
  targetUsers: "Пользователи",
  businessContact: "Контакт бизнеса",
  interactionFormat: "Формат взаимодействия",
};
export const EMPTY_FIELDS: TaskCardFields = {
  title: "",
  initialDescription: "",
  industry: "Другое",
  topic: "",
  contextAndNeed: "",
  dataAndMaterials: "",
  expectedResult: "",
  successCriteria: "",
  constraints: "",
  targetUsers: "",
  businessContact: "",
  interactionFormat: "",
};
export const INDUSTRIES = [
  "Ритейл",
  "Образование",
  "Экология",
  "Логистика",
  "Сервисы",
  "Другое",
];
export function fieldsOnly(task: TaskCardFields): TaskCardFields {
  return Object.fromEntries(
    (Object.keys(EMPTY_FIELDS) as FieldKey[]).map((key) => [key, task[key]]),
  ) as TaskCardFields;
}
export const LEVELS = READINESS_LEVELS;
export const levelFor = (score: number) =>
  LEVELS.find((level) => score >= level.min && score <= level.max) ?? LEVELS[0];

// Preview rules shared by the demo adapter and UI only. The HTTP adapter trusts server scores.
export function scoreBreakdown(fields: TaskCardFields, confirmed: FieldKey[]) {
  return SCORING_DIMENSIONS.map((dimension) => {
    const required: FieldKey[] = [...dimension.fields];
    const complete = required.every(
      (key) => fields[key].trim() && confirmed.includes(key),
    );
    return {
      ...dimension,
      earned: complete ? dimension.weight : 0,
      complete,
      missing: required.filter(
        (key) => !fields[key].trim() || !confirmed.includes(key),
      ),
    };
  });
}
export const scorePreview = (fields: TaskCardFields, confirmed: FieldKey[]) =>
  scoreBreakdown(fields, confirmed).reduce(
    (total, row) => total + row.earned,
    0,
  );
export function readinessPreview(
  fields: TaskCardFields,
  confirmed: FieldKey[],
): Readiness {
  const rows = scoreBreakdown(fields, confirmed).map((row) => ({
    key: row.key,
    label: row.label,
    weight: row.weight,
    earned: row.earned,
    fields: [...row.fields],
    missingFields: row.fields.filter((key) => !fields[key].trim()),
    unconfirmedFields: row.fields.filter(
      (key) => fields[key].trim() && !confirmed.includes(key),
    ),
    explanation: row.complete
      ? `Заполнено и подтверждено: +${row.earned} баллов.`
      : `Заполните и подтвердите: ${row.missing.map((key) => FIELD_LABELS[key]).join(", ")}.`,
  }));
  const score = rows.reduce((sum, row) => sum + row.earned, 0);
  return {
    score,
    readinessLevel: levelFor(score).key,
    scoreBreakdown: rows,
    missingFields: rows.flatMap((row) => row.missingFields),
    unconfirmedFields: rows.flatMap((row) => row.unconfirmedFields),
  };
}
export const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Не удалось выполнить действие. Попробуйте ещё раз.";
export const safeLink = (url: string) =>
  /^https?:\/\//i.test(url) ? url : undefined;
