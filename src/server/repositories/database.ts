import { z } from "zod";
import { ProposalSchema, TaskRecordSchema, TeamSchema } from "../../shared/contracts";

export const DatabaseSchema = z.object({
  schemaVersion: z.literal(1),
  tasks: z.array(TaskRecordSchema),
  teams: z.array(TeamSchema),
  proposals: z.array(ProposalSchema),
});
export type Database = z.infer<typeof DatabaseSchema>;

export interface Repository {
  read(): Promise<Database>;
  transaction<T>(change: (database: Database) => T): Promise<T>;
}
