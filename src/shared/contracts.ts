import { z } from "zod";

export const TaskStatusSchema = z.enum(["draft", "published", "archived"]);
export const ReadinessLevelSchema = z.enum([
  "draft",
  "workable",
  "ready",
  "priority",
]);

export const TaskCardFieldsSchema = z.object({
  title: z.string().trim().min(1),
  initialDescription: z.string().trim().min(1),
  industry: z.string().trim().min(1),
  topic: z.string().trim().min(1),
  contextAndNeed: z.string().trim().min(1),
  dataAndMaterials: z.string().trim(),
  expectedResult: z.string().trim().min(1),
  successCriteria: z.string().trim().min(1),
  constraints: z.string().trim(),
  targetUsers: z.string().trim().min(1),
  businessContact: z.string().trim().min(1),
  interactionFormat: z.string().trim().min(1),
});

export const TaskCardSchema = TaskCardFieldsSchema.extend({
  id: z.string().min(1),
  status: TaskStatusSchema,
  score: z.number().int().min(0).max(100),
  readinessLevel: ReadinessLevelSchema,
  confirmedFields: z.array(z.keyof(TaskCardFieldsSchema)),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ClarifyingQuestionSchema = z.object({
  id: z.string().min(1),
  field: z.keyof(TaskCardFieldsSchema),
  question: z.string().trim().min(1),
  reason: z.string().trim().min(1),
});

export const AnalyzeDraftRequestSchema = z.object({
  initialDescription: z.string().trim().min(10),
});

export const AnalyzeDraftResponseSchema = z.object({
  questions: z.array(ClarifyingQuestionSchema).min(3),
  missingFields: z.array(z.keyof(TaskCardFieldsSchema)),
});

export const ProposalStatusSchema = z.enum([
  "pending",
  "accepted",
  "rejected",
]);

export const ProposalSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  teamId: z.string().min(1),
  solutionIdea: z.string().trim().min(1),
  plan: z.string().trim().min(1),
  estimatedDuration: z.string().trim().min(1),
  prototypeUrl: z.string().url().or(z.literal("")),
  status: ProposalStatusSchema,
  createdAt: z.string().datetime(),
});

export type TaskCardFields = z.infer<typeof TaskCardFieldsSchema>;
export type TaskCard = z.infer<typeof TaskCardSchema>;
export type AnalyzeDraftRequest = z.infer<typeof AnalyzeDraftRequestSchema>;
export type AnalyzeDraftResponse = z.infer<typeof AnalyzeDraftResponseSchema>;
export type Proposal = z.infer<typeof ProposalSchema>;
