import { z } from "zod";
import {
  TaskCardFieldsSchema,
  TaskCardSchema,
  ProposalSchema,
  MilestoneSchema,
} from "@/shared/contracts";
import { readinessPreview } from "./model";

export const CardViewFieldsSchema = TaskCardFieldsSchema;
// Migrate the earlier browser-only demo in memory, keeping all user-created data.
export const TaskViewSchema = z.preprocess((value) => {
  const legacy = TaskCardFieldsSchema.extend({
    confirmedFields: z.array(TaskCardFieldsSchema.keyof()),
    createdAt: z.string(),
    status: z.string(),
  }).safeParse(value);
  if (!legacy.success || typeof value !== "object" || !value) return value;
  return {
    version: 1,
    publishedAt:
      legacy.data.status === "published" ? legacy.data.createdAt : null,
    ...value,
    ...readinessPreview(legacy.data, legacy.data.confirmedFields),
  };
}, TaskCardSchema);
export const TeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  skills: z.array(z.string()),
  interests: z.array(z.string()),
  technologies: z.array(z.string()).optional(),
  points: z.number().nonnegative(),
});
export const LegacyMilestoneSchema = z.object({
  proposalId: z.string(),
  points: z.number().nonnegative(),
  confirmedAt: z.string().datetime(),
}).strict();
export const DemoDatabaseSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object" || !("milestones" in value) || !Array.isArray(value.milestones)) return value;
  if ("legacyMilestones" in value && !Array.isArray(value.legacyMilestones)) return value;
  const legacy = value.milestones.filter((item) => !MilestoneSchema.safeParse(item).success && LegacyMilestoneSchema.safeParse(item).success);
  return {
    ...value,
    milestones: value.milestones.filter((item) => !legacy.includes(item)),
    legacyMilestones: [
      ...("legacyMilestones" in value && Array.isArray(value.legacyMilestones) ? value.legacyMilestones : []),
      ...legacy,
    ],
  };
}, z.object({
  version: z.literal(1),
  tasks: z.array(TaskViewSchema),
  proposals: z.array(
    z.preprocess((value) => {
      if (typeof value !== "object" || !value || !("createdAt" in value))
        return value;
      return {
        decisionComment: "",
        decidedAt: null,
        updatedAt: value.createdAt,
        ...value,
      };
    }, ProposalSchema),
  ),
  teams: z.array(TeamSchema),
  milestones: z.array(MilestoneSchema),
  // Preserve old one-click demo awards as history, not as evidence-backed new milestones.
  legacyMilestones: z.array(LegacyMilestoneSchema).default([]),
}));
export function parseResponse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success)
    throw new Error(
      "Сервер вернул данные в неподдерживаемом формате. Попробуйте ещё раз.",
    );
  return result.data;
}
