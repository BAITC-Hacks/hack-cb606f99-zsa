import { defineConfig } from "vitest/config";

// Explicit opt-in only: ordinary pnpm test/check never runs paid API evaluations.
export default defineConfig({ test: {
  include: ["evals/**/*.eval.ts"], testTimeout: 130000,
  fileParallelism: false, maxWorkers: 1,
} });
