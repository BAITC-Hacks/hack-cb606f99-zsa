import { platform } from "@/server/bootstrap";
import { api, queryParams } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return api(() => platform.listProposals(queryParams(request)));
}
