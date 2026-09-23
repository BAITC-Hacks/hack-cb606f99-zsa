import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformService } from "@/server/services/platform";
import { AiService } from "@/server/ai/service";
import { MockAiProvider } from "@/server/ai/mock";
import { createSeed } from "@/server/repositories/seed";
import type { Database, Repository } from "@/server/repositories/database";
import { api } from "@/server/http";
import { emptyTaskFields } from "@/shared/contracts";
import { httpService, ApiClientError } from "./service";

// Exercise the browser adapter against the real services and their strict schemas.
// An isolated in-memory repository keeps working demo data untouched.
class MemoryRepository implements Repository {
  data = createSeed();
  async read() {
    return structuredClone(this.data);
  }
  async transaction<T>(change: (data: Database) => T) {
    const copy = structuredClone(this.data);
    const result = change(copy);
    this.data = copy;
    return result;
  }
}
let platform: PlatformService;
beforeEach(() => {
  platform = new PlatformService(new MemoryRepository());
  const ai = new AiService(new MockAiProvider(), "mock");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const url = new URL(input, "http://localhost");
      const parts = url.pathname.split("/").filter(Boolean);
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      const query = Object.fromEntries(url.searchParams);
      const method = init.method ?? "GET";
      return api(async () => {
        if (parts[1] === "ai")
          return parts[2] === "questions"
            ? ai.analyze(body)
            : ai.buildCard(body);
        if (parts[1] === "teams") return platform.listTeams();
        if (parts[1] === "proposals")
          return platform.decideProposal(parts[2], body);
        if (parts[1] === "tasks") {
          if (!parts[2])
            return method === "POST"
              ? platform.createTask(body)
              : platform.listTasks(query);
          if (parts[3] === "publish")
            return platform.publishTask(parts[2], body);
          if (parts[3] === "proposals")
            return method === "POST"
              ? platform.createProposal(parts[2], body)
              : platform.listProposals(query, parts[2]);
          return method === "PATCH"
            ? platform.updateTask(parts[2], body)
            : platform.getTask(parts[2]);
        }
        throw new Error(`Unexpected API request: ${method} ${url.pathname}`);
      });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("frontend to backend integration", () => {
  it("sends selected industry with analysis and does not ask for it again", async () => {
    const description = "В кофейне большие очереди. Хотим улучшить обслуживание гостей.";
    const withoutFields = await httpService.analyze(description);
    expect(withoutFields.missingFields).toContain("industry");

    const analysis = await httpService.analyze(description, { industry: "Ритейл" });
    const [, init] = vi.mocked(fetch).mock.calls.at(-1)!;
    expect(JSON.parse(String(init?.body))).toEqual({
      initialDescription: description,
      fields: { industry: "Ритейл" },
    });
    expect(analysis.missingFields).not.toContain("industry");
    expect(analysis.questions.some((question) => question.field === "industry")).toBe(false);
    expect(analysis.questions.length).toBeGreaterThanOrEqual(3);
  });

  it("maps AI answers, preserves metadata, publishes and makes manual decisions", async () => {
    const description = "Пекарне нужен простой учёт непроданной выпечки";
    const analysis = await httpService.analyze(description);
    expect(analysis.questions.length).toBeGreaterThanOrEqual(3);
    expect(analysis.ai.warning).toContain("Деморежим");
    const generated = await httpService.generate({
      initialDescription: description,
      industry: "Ритейл",
      answers: {
        expectedResult: "Таблица остатков",
        businessContact: "",
        constraints: "   ",
      },
    });
    expect(generated.card.expectedResult).toBe("Таблица остатков");
    expect(generated.card.businessContact).toBe("");
    const task = await httpService.saveTask({
      fields: generated.card,
      confirmedFields: ["title", "expectedResult"],
    });
    expect(task.score).toBe(15);
    expect(task.version).toBe(1);
    expect(
      (await httpService.listTasks()).some((item) => item.id === task.id),
    ).toBe(false);
    expect(
      (await httpService.listTasks(true)).some((item) => item.id === task.id),
    ).toBe(true);
    const published = await httpService.publishTask(task.id, task.version);
    expect(published.status).toBe("published");
    expect(published.version).toBe(2);
    expect(
      (await httpService.getTask(task.id)).scoreBreakdown.find(
        (row) => row.key === "expectedResult",
      )?.earned,
    ).toBe(15);
    const teams = await httpService.listTeams();
    const proposal = await httpService.submitProposal(task.id, {
      teamId: teams[0].id,
      solutionIdea: "Панель учёта",
      plan: "Интервью и прототип",
      estimatedDuration: "2 недели",
      prototypeUrl: "",
    });
    expect(proposal.status).toBe("pending");
    expect(
      (await httpService.decideProposal(proposal.id, "accepted")).status,
    ).toBe("accepted");
    expect(
      (await httpService.decideProposal(proposal.id, "rejected")).status,
    ).toBe("rejected");
    expect((await httpService.listProposals(task.id))[0].id).toBe(proposal.id);
    expect(httpService.supportsMilestones).toBe(false);
  });

  it("sends optimistic versions and preserves an intervening server edit", async () => {
    const fields = {
      ...emptyTaskFields("Нужно сделать учёт заказов магазина"),
      title: "Заказы",
    };
    const original = await httpService.saveTask({
      fields,
      confirmedFields: ["title"],
    });
    const updated = await httpService.saveTask(
      {
        fields: { ...fields, title: "Новые заказы" },
        confirmedFields: ["title"],
        expectedVersion: original.version,
      },
      original.id,
    );
    await expect(
      httpService.saveTask(
        {
          fields,
          confirmedFields: ["title"],
          expectedVersion: original.version,
        },
        original.id,
      ),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    expect((await httpService.getTask(original.id)).title).toBe("Новые заказы");
    await expect(
      httpService.publishTask(original.id, original.version),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    expect(
      (await httpService.publishTask(original.id, updated.version)).score,
    ).toBe(0);
  });

  it("surfaces validation, provider failures and network errors without demo fallback", async () => {
    const task = await httpService.saveTask({
      fields: {
        ...emptyTaskFields("Нужен прототип записи клиентов"),
        title: "Запись",
      },
      confirmedFields: [],
    });
    await expect(
      httpService.publishTask(task.id, task.version),
    ).rejects.toMatchObject({ code: "REVIEW_REQUIRED" });
    await expect(
      httpService.generate({
        initialDescription: task.initialDescription,
        industry: "Ритейл",
        answers: { businessContact: "a".repeat(201) },
      }),
    ).rejects.toBeInstanceOf(ApiClientError);
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json(
        {
          error: {
            code: "AI_UNAVAILABLE",
            message: "AI недоступен",
            details: [],
          },
        },
        { status: 502 },
      ),
    );
    await expect(
      httpService.analyze(task.initialDescription),
    ).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("offline"));
    await expect(httpService.listTasks()).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ tasks: [{ id: "broken" }], total: 1 }),
    );
    await expect(httpService.listTasks()).rejects.toThrow(
      "неподдерживаемом формате",
    );
  });
});
