import { ZodError } from "zod";

export class AiOutputError extends Error {
  constructor(
    public readonly reason: "DUPLICATE_QUESTIONS" | "INCOMPLETE_RESPONSE",
  ) { super(reason); }
}

// Never log provider messages: authentication failures can contain credentials.
export function safeAiDiagnostic(error: unknown) {
  if (error instanceof AiOutputError) return { reason: error.reason };
  if (error instanceof ZodError) return { reason: "INVALID_OUTPUT_SHAPE" };
  const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
  return { reason: "PROVIDER_FAILURE", status: typeof status === "number" ? status : undefined };
}
