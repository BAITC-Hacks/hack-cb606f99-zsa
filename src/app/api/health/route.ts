import { serverEnv } from "@/server/env";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    status: "ok",
    service: "hackalem-ai-tasks",
    aiProvider: serverEnv.AI_PROVIDER,
    timestamp: new Date().toISOString(),
  });
}
