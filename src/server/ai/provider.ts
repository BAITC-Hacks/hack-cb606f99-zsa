import type { AnalyzeDraftRequest, TaskCardFields } from "../../shared/contracts";
import type { z } from "zod";
import type { AnalysisSchema, BuildCardRequestSchema } from "../../shared/contracts";

export type CardInput = z.output<typeof BuildCardRequestSchema>;
export type ProviderAnalysis = z.infer<typeof AnalysisSchema> & { knownFields?: TaskCardFields };
export interface AiProvider {
  analyze(input: AnalyzeDraftRequest): Promise<ProviderAnalysis>;
  buildCard(input: CardInput): Promise<TaskCardFields>;
}
