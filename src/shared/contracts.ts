import { z } from "zod";

const text = z.string().trim().max(5000);
const shortText = z.string().trim().max(200);
export const IdSchema = z.string().trim().min(1).max(100).regex(/^[\w-]+$/);
export const TaskStatusSchema = z.enum(["draft", "published", "archived"]);
export const ReadinessLevelSchema = z.enum(["draft", "workable", "ready", "priority"]);

// Unknown facts stay empty. Completeness is scored, not required for a draft.
export const TaskCardFieldsSchema = z.object({
  title: shortText,
  initialDescription: z.string().trim().min(10).max(10000),
  industry: shortText,
  topic: shortText,
  contextAndNeed: text,
  dataAndMaterials: text,
  expectedResult: text,
  successCriteria: text,
  constraints: text,
  targetUsers: text,
  businessContact: shortText,
  interactionFormat: text,
});
export const TaskFieldSchema = TaskCardFieldsSchema.keyof();
export const TASK_FIELDS = TaskFieldSchema.options;
const confirmedFields = z.array(TaskFieldSchema).max(TASK_FIELDS.length)
  .refine((fields) => new Set(fields).size === fields.length, "Поля не должны повторяться");

export const TaskRecordSchema = TaskCardFieldsSchema.extend({
  id: IdSchema,
  status: TaskStatusSchema,
  confirmedFields,
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  publishedAt: z.string().datetime().nullable(),
});

export const ScoreBreakdownSchema = z.object({
  key: TaskFieldSchema,
  label: z.string(),
  weight: z.number().int(),
  earned: z.number().int(),
  fields: z.array(TaskFieldSchema),
  missingFields: z.array(TaskFieldSchema),
  unconfirmedFields: z.array(TaskFieldSchema),
  explanation: z.string(),
});
export const ReadinessSchema = z.object({
  score: z.number().int().min(0).max(100),
  readinessLevel: ReadinessLevelSchema,
  scoreBreakdown: z.array(ScoreBreakdownSchema),
  missingFields: z.array(TaskFieldSchema),
  unconfirmedFields: z.array(TaskFieldSchema),
});
export const TaskCardSchema = TaskRecordSchema.extend(ReadinessSchema.shape);

export const CreateTaskRequestSchema = TaskCardFieldsSchema.partial().extend({
  initialDescription: TaskCardFieldsSchema.shape.initialDescription,
  confirmedFields: confirmedFields.default([]),
}).strict();
export const UpdateTaskRequestSchema = TaskCardFieldsSchema.partial().extend({
  confirmedFields: confirmedFields.optional(),
  expectedVersion: z.number().int().positive().optional(),
}).strict().refine(
  (value) => Object.keys(value).some((key) => key !== "expectedVersion"),
  "Передайте хотя бы одно поле для изменения",
);
export const PublishTaskRequestSchema = z.object({
  confirmed: z.literal(true),
  expectedVersion: z.number().int().positive().optional(),
}).strict();
export const ArchiveTaskRequestSchema = z.object({
  expectedVersion: z.number().int().positive().optional(),
}).strict();
export const TaskQuerySchema = z.object({
  status: z.enum(["draft", "published", "archived", "all"]).default("published"),
  readinessLevel: ReadinessLevelSchema.optional(),
  industry: shortText.optional(),
  topic: shortText.optional(),
  q: shortText.optional(),
}).strict();

export const TeamFieldsSchema = z.object({
  name: shortText.min(1),
  interests: z.array(shortText.min(1)).min(1).max(20),
  skills: z.array(shortText.min(1)).min(1).max(20),
  technologies: z.array(shortText.min(1)).min(1).max(20),
});
export const CreateTeamRequestSchema = TeamFieldsSchema.strict();
export const TeamSchema = TeamFieldsSchema.extend({ id: IdSchema, createdAt: z.string().datetime() });
export const ProposalStatusSchema = z.enum(["pending", "accepted", "rejected"]);
export const CreateProposalRequestSchema = z.object({
  teamId: IdSchema,
  solutionIdea: text.min(1),
  plan: text.min(1),
  estimatedDuration: shortText.min(1),
  prototypeUrl: z.union([
    z.string().trim().max(2000).url().refine((url) => /^https?:\/\//i.test(url), "Нужна HTTP(S)-ссылка"),
    z.literal(""),
  ]).default(""),
}).strict();
export const ProposalSchema = CreateProposalRequestSchema.extend({
  id: IdSchema,
  taskId: IdSchema,
  status: ProposalStatusSchema,
  decisionComment: text,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  decidedAt: z.string().datetime().nullable(),
});
export const DecideProposalRequestSchema = z.object({
  status: z.enum(["accepted", "rejected"]),
  decisionComment: text.default(""),
}).strict();
export const ProposalQuerySchema = z.object({
  teamId: IdSchema.optional(),
  status: ProposalStatusSchema.optional(),
}).strict();

export const ClarifyingQuestionSchema = z.object({
  id: IdSchema,
  field: TaskFieldSchema,
  question: z.string().trim().min(1).max(1000),
  reason: z.string().trim().min(1).max(1000),
});
export const AnalyzeDraftRequestSchema = z.object({
  initialDescription: TaskCardFieldsSchema.shape.initialDescription,
  fields: TaskCardFieldsSchema.omit({ initialDescription: true }).partial().optional(),
}).strict();
export const AnalysisSchema = z.object({
  questions: z.array(ClarifyingQuestionSchema).min(3).max(12),
  missingFields: z.array(TaskFieldSchema).max(TASK_FIELDS.length),
});
export const AiMetadataSchema = z.object({
  provider: z.enum(["mock", "openai"]),
  fallback: z.boolean(),
  warning: z.string().nullable(),
});
export const AnalyzeDraftResponseSchema = AnalysisSchema.extend({ ai: AiMetadataSchema });
export const BuildCardRequestSchema = z.object({
  initialDescription: TaskCardFieldsSchema.shape.initialDescription,
  fields: TaskCardFieldsSchema.omit({ initialDescription: true }).partial().optional(),
  answers: z.array(z.object({
    field: TaskFieldSchema.exclude(["initialDescription"]),
    answer: text.min(1),
  }).strict()).max(20).default([]),
}).strict();
export const BuildCardResponseSchema = z.object({
  card: TaskCardFieldsSchema,
  confirmedFields: z.array(TaskFieldSchema).length(0),
  ai: AiMetadataSchema,
});

export const TaskResponseSchema = z.object({ task: TaskCardSchema });
export const TaskListResponseSchema = z.object({ tasks: z.array(TaskCardSchema), total: z.number().int() });
export const TeamResponseSchema = z.object({ team: TeamSchema });
export const TeamListResponseSchema = z.object({ teams: z.array(TeamSchema), total: z.number().int() });
export const ProposalResponseSchema = z.object({ proposal: ProposalSchema });
export const ProposalListResponseSchema = z.object({ proposals: z.array(ProposalSchema), total: z.number().int() });
export const ApiErrorSchema = z.object({ error: z.object({
  code: z.string(), message: z.string(), details: z.array(z.object({ path: z.string(), message: z.string() })),
}) });

export type TaskField = z.infer<typeof TaskFieldSchema>;
export type TaskCardFields = z.infer<typeof TaskCardFieldsSchema>;
export type TaskRecord = z.infer<typeof TaskRecordSchema>;
export type TaskCard = z.infer<typeof TaskCardSchema>;
export type Readiness = z.infer<typeof ReadinessSchema>;
export type CreateTaskRequest = z.input<typeof CreateTaskRequestSchema>;
export type UpdateTaskRequest = z.input<typeof UpdateTaskRequestSchema>;
export type TaskQuery = z.input<typeof TaskQuerySchema>;
export type Team = z.infer<typeof TeamSchema>;
export type CreateTeamRequest = z.input<typeof CreateTeamRequestSchema>;
export type Proposal = z.infer<typeof ProposalSchema>;
export type CreateProposalRequest = z.input<typeof CreateProposalRequestSchema>;
export type AnalyzeDraftRequest = z.infer<typeof AnalyzeDraftRequestSchema>;
export type AnalyzeDraftResponse = z.infer<typeof AnalyzeDraftResponseSchema>;
export type BuildCardRequest = z.input<typeof BuildCardRequestSchema>;
export type BuildCardResponse = z.infer<typeof BuildCardResponseSchema>;
export type AiMetadata = z.infer<typeof AiMetadataSchema>;

export function emptyTaskFields(initialDescription: string): TaskCardFields {
  return {
    title: "", initialDescription, industry: "", topic: "", contextAndNeed: "",
    dataAndMaterials: "", expectedResult: "", successCriteria: "", constraints: "",
    targetUsers: "", businessContact: "", interactionFormat: "",
  };
}
