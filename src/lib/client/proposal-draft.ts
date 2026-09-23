import { z } from "zod";
import { CreateProposalRequestSchema } from "@/shared/contracts";
import type { ProposalInput } from "./model";

export const PROPOSAL_LIMITS = {
  solutionIdea: CreateProposalRequestSchema.shape.solutionIdea.maxLength!,
  plan: CreateProposalRequestSchema.shape.plan.maxLength!,
  estimatedDuration: CreateProposalRequestSchema.shape.estimatedDuration.maxLength!,
  prototypeUrl: CreateProposalRequestSchema.shape.prototypeUrl.unwrap().options[0].maxLength!,
};
export const EMPTY_PROPOSAL: ProposalInput = {
  teamId: "", solutionIdea: "", plan: "", estimatedDuration: "", prototypeUrl: "",
};
// Drafts may contain unfinished URLs and empty fields; submit validation stays on the API.
const DraftSchema = z.object({
  teamId: z.string().max(100),
  solutionIdea: z.string().max(PROPOSAL_LIMITS.solutionIdea),
  plan: z.string().max(PROPOSAL_LIMITS.plan),
  estimatedDuration: z.string().max(PROPOSAL_LIMITS.estimatedDuration),
  prototypeUrl: z.string().max(PROPOSAL_LIMITS.prototypeUrl),
});
const key = (id: string) => `taskhub-proposal-draft:${id}`;

export function readProposalDraft(id: string): ProposalInput | null {
  try {
    const raw = sessionStorage.getItem(key(id));
    if (!raw) return null;
    const parsed = DraftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

export function saveProposalDraft(id: string, form: ProposalInput) {
  try {
    if (form.solutionIdea || form.plan || form.estimatedDuration || form.prototypeUrl)
      sessionStorage.setItem(key(id), JSON.stringify(form));
    else sessionStorage.removeItem(key(id));
  } catch { /* The form still works when browser storage is unavailable. */ }
}

export function clearProposalDraft(id: string) {
  try { sessionStorage.removeItem(key(id)); } catch { /* No persistent draft to clear. */ }
}
