import { z } from "zod";
import { MilestoneSchema, ProposalSchema, TaskRecordSchema, TeamRecordSchema } from "../../shared/contracts";

export const DatabaseSchema = z.object({
  schemaVersion: z.literal(1),
  tasks: z.array(TaskRecordSchema),
  teams: z.array(TeamRecordSchema),
  proposals: z.array(ProposalSchema),
  // Existing schemaVersion 1 databases gain an empty collection in memory, not a reseed.
  milestones: z.array(MilestoneSchema).default([]),
}).superRefine((database, context) => {
  const ids = new Set<string>();
  const proposals = new Map(database.proposals.map((proposal) => [proposal.id, proposal]));
  const taskIds = new Set(database.tasks.map((task) => task.id));
  const teamIds = new Set(database.teams.map((team) => team.id));
  database.milestones.forEach((milestone, index) => {
    const issue = (field: string, message: string) =>
      context.addIssue({ code: "custom", path: ["milestones", index, field], message });
    if (ids.has(milestone.id)) issue("id", "Этапы должны иметь уникальные идентификаторы");
    ids.add(milestone.id);
    const proposal = proposals.get(milestone.proposalId);
    if (!proposal) issue("proposalId", "Заявка этапа не существует");
    if (!taskIds.has(milestone.taskId)) issue("taskId", "Задача этапа не существует");
    if (!teamIds.has(milestone.teamId)) issue("teamId", "Команда этапа не существует");
    if (proposal && proposal.taskId !== milestone.taskId) issue("taskId", "Этап должен относиться к задаче заявки");
    if (proposal && proposal.teamId !== milestone.teamId) issue("teamId", "Этап должен относиться к команде заявки");
    // Rejected proposals and archived tasks retain valid historical progress.
  });
});
export type Database = z.infer<typeof DatabaseSchema>;

export interface Repository {
  read(): Promise<Database>;
  transaction<T>(change: (database: Database) => T): Promise<T>;
}
