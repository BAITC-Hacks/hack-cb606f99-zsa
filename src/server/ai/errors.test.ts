import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AiOutputError, safeAiDiagnostic } from "./errors";

describe("safe AI diagnostics", () => {
  it("reports incomplete output without the source value", () => {
    expect(safeAiDiagnostic(new AiOutputError("INCOMPLETE_RESPONSE")))
      .toEqual({ reason: "INCOMPLETE_RESPONSE" });
  });
  it("never exposes credentials, provider messages, or validation messages", () => {
    const upstream = Object.assign(new Error("Incorrect API key: secret-value"), { status: 401, code: "secret-value" });
    expect(safeAiDiagnostic(upstream)).toEqual({ reason: "PROVIDER_FAILURE", status: 401 });
    const invalid = z.literal("secret-value").safeParse("different-value");
    if (!invalid.success) expect(safeAiDiagnostic(invalid.error)).toEqual({ reason: "INVALID_OUTPUT_SHAPE" });
  });
});
