import { platform } from "@/server/bootstrap";
import { api, readJson, type IdContext } from "@/server/http";

export const runtime = "nodejs";
export function PATCH(request: Request, context: IdContext) {
  return api(async () => platform.decideProposal((await context.params).id, await readJson(request)));
}
