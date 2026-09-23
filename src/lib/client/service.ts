import {
  AnalyzeDraftResponseSchema,
  BuildCardResponseSchema,
  TaskResponseSchema,
  TaskListResponseSchema,
  TeamListResponseSchema,
  ProposalResponseSchema,
  ProposalListResponseSchema,
  ApiErrorSchema,
  MilestoneResponseSchema,
  MilestoneListResponseSchema,
} from "@/shared/contracts";
import { z } from "zod";
import { type TaskService } from "./model";
import { mockService } from "./mock-service";
import { parseResponse } from "./schemas";
import { ApiClientError } from "./api-error";
export { ApiClientError } from "./api-error";

// Live backend is the default. Offline mode must be selected explicitly.
export const IS_DEMO = process.env.NEXT_PUBLIC_DATA_MODE === "mock";
const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

async function request(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      cache: "no-store",
      ...(body === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
      // The server allows an AI timeout of up to 60 seconds plus a local fallback.
      signal: AbortSignal.timeout(75_000),
    });
  } catch {
    throw new ApiClientError(
      "NETWORK_ERROR",
      "Сервер не отвечает. Проверьте подключение и повторите запрос.",
    );
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiClientError(
      "INVALID_RESPONSE",
      "Сервер вернул некорректный ответ. Попробуйте позже.",
    );
  }
  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(data);
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      throw new ApiClientError(code, message, details);
    }
    throw new ApiClientError(
      "HTTP_ERROR",
      `Не удалось выполнить запрос (${response.status}).`,
    );
  }
  return data;
}

export const httpService: TaskService = {
  supportsMilestones: true,
  listTasks: async (all) =>
    parseResponse(
      TaskListResponseSchema,
      await request(`/api/tasks${all ? "?status=all" : ""}`),
    ).tasks,
  getTask: async (id) =>
    parseResponse(
      TaskResponseSchema,
      await request(`/api/tasks/${encodeURIComponent(id)}`),
    ).task,
  analyze: async (initialDescription, fields) =>
    parseResponse(
      AnalyzeDraftResponseSchema,
      await request("/api/ai/questions", "POST", {
        initialDescription,
        ...(fields === undefined ? {} : { fields }),
      }),
    ),
  generate: async ({ initialDescription, industry, answers }) =>
    parseResponse(
      BuildCardResponseSchema,
      await request("/api/ai/card", "POST", {
        initialDescription,
        fields: { industry },
        answers: Object.entries(answers)
          .filter(
            ([field, answer]) =>
              field !== "initialDescription" && answer?.trim(),
          )
          .map(([field, answer]) => ({ field, answer: answer!.trim() })),
      }),
    ),
  saveTask: async ({ fields, confirmedFields, expectedVersion }, id) =>
    parseResponse(
      TaskResponseSchema,
      await request(
        id ? `/api/tasks/${encodeURIComponent(id)}` : "/api/tasks",
        id ? "PATCH" : "POST",
        {
          ...fields,
          confirmedFields,
          ...(id && expectedVersion !== undefined ? { expectedVersion } : {}),
        },
      ),
    ).task,
  publishTask: async (id, expectedVersion) =>
    parseResponse(
      TaskResponseSchema,
      await request(`/api/tasks/${encodeURIComponent(id)}/publish`, "POST", {
        confirmed: true,
        ...(expectedVersion === undefined ? {} : { expectedVersion }),
      }),
    ).task,
  listTeams: async () =>
    parseResponse(TeamListResponseSchema, await request("/api/teams")).teams,
  listProposals: async (id) =>
    parseResponse(
      ProposalListResponseSchema,
      await request(`/api/tasks/${encodeURIComponent(id)}/proposals`),
    ).proposals,
  submitProposal: async (id, input) =>
    parseResponse(
      ProposalResponseSchema,
      await request(
        `/api/tasks/${encodeURIComponent(id)}/proposals`,
        "POST",
        input,
      ),
    ).proposal,
  archiveTask: async (id, expectedVersion) =>
    parseResponse(
      TaskResponseSchema,
      await request(`/api/tasks/${encodeURIComponent(id)}/archive`, "POST", {
        ...(expectedVersion === undefined ? {} : { expectedVersion }),
      }),
    ).task,
  decideProposal: async (id, status, decisionComment) =>
    parseResponse(
      ProposalResponseSchema,
      await request(
        `/api/proposals/${encodeURIComponent(id)}/status`,
        "PATCH",
        { status, ...(decisionComment === undefined ? {} : { decisionComment }) },
      ),
    ).proposal,
  listMilestones: async (taskId) => parseResponse(
    MilestoneListResponseSchema,
    await request(`/api/tasks/${encodeURIComponent(taskId)}/milestones`),
  ).milestones,
  createMilestone: async (proposalId, input) => parseResponse(
    MilestoneResponseSchema,
    await request(`/api/proposals/${encodeURIComponent(proposalId)}/milestones`, "POST", input),
  ).milestone,
  submitMilestone: async (id, input) => parseResponse(
    MilestoneResponseSchema,
    await request(`/api/milestones/${encodeURIComponent(id)}/submit`, "POST", input),
  ).milestone,
  reviewMilestone: async (id, input) => parseResponse(
    MilestoneResponseSchema,
    await request(`/api/milestones/${encodeURIComponent(id)}/review`, "POST", input),
  ).milestone,
};

const HealthSchema = z.object({
  status: z.literal("ok"),
  aiProvider: z.enum(["mock", "openai"]),
});
export const getServerStatus = async () =>
  IS_DEMO
    ? { status: "ok" as const, aiProvider: "mock" as const }
    : parseResponse(HealthSchema, await request("/api/health"));
export const taskService: TaskService = IS_DEMO ? mockService : httpService;
