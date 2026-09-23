import "server-only";

import { z } from "zod";

const serverEnvSchema = z
  .object({
    AI_PROVIDER: z.enum(["mock", "openai"]).default("mock"),
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_MODEL: z.string().min(1).optional(),
    DATA_FILE_PATH: z.string().min(1).default("./data/db.json"),
    AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(15000),
    AI_FALLBACK_TO_MOCK: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
  })
  .superRefine((env, context) => {
    if (env.AI_PROVIDER !== "openai") {
      return;
    }

    if (!env.OPENAI_API_KEY) {
      context.addIssue({
        code: "custom",
        path: ["OPENAI_API_KEY"],
        message: "OPENAI_API_KEY is required when AI_PROVIDER=openai",
      });
    }

    if (!env.OPENAI_MODEL) {
      context.addIssue({
        code: "custom",
        path: ["OPENAI_MODEL"],
        message: "OPENAI_MODEL is required when AI_PROVIDER=openai",
      });
    }
  });

export const serverEnv = serverEnvSchema.parse({
  AI_PROVIDER: process.env.AI_PROVIDER,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || undefined,
  OPENAI_MODEL: process.env.OPENAI_MODEL || undefined,
  DATA_FILE_PATH: process.env.DATA_FILE_PATH,
  AI_TIMEOUT_MS: process.env.AI_TIMEOUT_MS,
  AI_FALLBACK_TO_MOCK: process.env.AI_FALLBACK_TO_MOCK,
});
