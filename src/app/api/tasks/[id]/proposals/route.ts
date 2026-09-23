import { platform } from "@/server/bootstrap";
import { api, queryParams, readJson, type IdContext } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request, context: IdContext) {
  return api(async () => platform.listProposals(queryParams(request), (await context.params).id));
}
export function POST(request: Request, context: IdContext) {
  return api(async () => platform.createProposal((await context.params).id, await readJson(request)), 201);
}
