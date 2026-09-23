import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, expect, it } from "vitest";
import { AiService } from "../src/server/ai/service";
import { OpenAiProvider } from "../src/server/ai/openai";
import { AnalyzeDraftResponseSchema, BuildCardResponseSchema } from "../src/shared/contracts";
import { AI_CASES } from "./cases";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const model = process.env.AI_EVAL_MODEL || process.env.OPENAI_MODEL;
const apiKey = process.env.OPENAI_API_KEY;
if (!model || !apiKey) throw new Error("Set OPENAI_API_KEY and OPENAI_MODEL in .env.local before running the live evaluation.");
const ai = new AiService(new OpenAiProvider({ apiKey, model, timeoutMs: 60000 }), "openai", false);
const label = (process.env.AI_EVAL_LABEL || "current").replace(/[^a-z0-9-]/gi, "-");
const selected = process.env.AI_EVAL_CASES?.split(",");
const cases = selected ? AI_CASES.filter((item) => selected.includes(item.id)) : AI_CASES;
if (!cases.length) throw new Error("No matching evaluation cases");
const results: { caseId: string; endpoint: string; elapsedMs: number; failures: string[]; response?: unknown }[] = [];

afterAll(async () => {
  const directory = join(process.cwd(), "data", "ai-evals");
  await mkdir(directory, { recursive: true });
  const file = join(directory, `${new Date().toISOString().replace(/[:.]/g, "-")}-${label}.json`);
  await writeFile(file, JSON.stringify({ label, model, createdAt: new Date().toISOString(), results }, null, 2), { flag: "wx" });
  console.table(results.map((result) => ({ caseId: result.caseId, endpoint: result.endpoint, elapsedMs: result.elapsedMs, failedChecks: result.failures.length })));
  console.log(`Synthetic evaluation report: ${file}`);
});

for (const fixture of cases) {
  it(`${fixture.id}: grounded card and non-redundant questions`, async () => {
    const failures: string[] = [];
    for (const endpoint of ["questions", "card"] as const) {
      const started = Date.now();
      const checks: string[] = [];
      let response: unknown;
      try {
        if (endpoint === "questions") {
          const analysis = AnalyzeDraftResponseSchema.parse(await ai.analyze({ initialDescription: fixture.input.initialDescription, fields: fixture.input.fields }));
          response = analysis;
          for (const field of Object.keys(fixture.known)) {
            if (analysis.missingFields.some((item) => item === field)) checks.push(`Known field marked missing: ${field}`);
            if (analysis.questions.some((item) => item.field === field && !item.question.startsWith("Проверка:"))) checks.push(`Repeated known field: ${field}`);
          }
          for (const field of fixture.absent) if (!analysis.missingFields.includes(field)) checks.push(`Missing gap: ${field}`);
          if (fixture.id === "complete-user-edits" && analysis.missingFields.length) checks.push("Complete card has gaps");
          if (analysis.ai.provider !== "openai" || analysis.ai.fallback) checks.push("Not a live model response");
        } else {
          const generated = BuildCardResponseSchema.parse(await ai.buildCard(fixture.input));
          response = generated;
          for (const [field, expected] of Object.entries(fixture.known)) {
            if (!expected.test(generated.card[field as keyof typeof generated.card])) checks.push(`Lost known fact: ${field}`);
          }
          for (const field of fixture.absent) if (generated.card[field]) checks.push(`Unexpected content in absent field: ${field}`);
          for (const [field, value] of Object.entries(fixture.exact ?? {})) if (generated.card[field as keyof typeof generated.card] !== value) checks.push(`Overwrote user edit: ${field}`);
          if (generated.ai.provider !== "openai" || generated.ai.fallback) checks.push("Not a live model response");
        }
      } catch { checks.push("Request failed (see safe server diagnostic)"); }
      results.push({ caseId: fixture.id, endpoint, elapsedMs: Date.now() - started, failures: checks, response });
      failures.push(...checks.map((message) => `${endpoint}: ${message}`));
    }
    expect(failures, fixture.id).toEqual([]);
  });
}
