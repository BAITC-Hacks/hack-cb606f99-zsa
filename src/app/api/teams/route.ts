import { platform } from "@/server/bootstrap";
import { api, readJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() { return api(() => platform.listTeams()); }
export function POST(request: Request) {
  return api(async () => platform.createTeam(await readJson(request)), 201);
}
