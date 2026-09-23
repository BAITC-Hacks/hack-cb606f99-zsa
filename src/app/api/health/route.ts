import { serverEnv } from "@/server/env";
import { repository } from "@/server/bootstrap";
import { api } from "@/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return api(async () => {
    const data = await repository.checkReadiness();
    return {
      status: "ok", service: "hackalem-ai-tasks", aiProvider: serverEnv.AI_PROVIDER,
      storage: "json", demoAuth: true,
      checks: { storage: "read_write_ok", ai: "not_checked" },
      counts: { tasks: data.tasks.length, teams: data.teams.length, proposals: data.proposals.length },
      timestamp: new Date().toISOString(),
    };
  });
}
