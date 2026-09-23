import type { AnalyzeDraftRequest, TaskCardFields } from "../../shared/contracts";
import type { z } from "zod";
import type { AnalysisSchema, BuildCardRequestSchema } from "../../shared/contracts";

export type CardInput = z.output<typeof BuildCardRequestSchema>;
export interface AiProvider {
  analyze(input: AnalyzeDraftRequest): Promise<z.infer<typeof AnalysisSchema>>;
  buildCard(input: CardInput): Promise<TaskCardFields>;
}
