import { platform } from "@/server/bootstrap";
import { api, type IdContext } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(_request: Request, context: IdContext) {
  return api(async () => platform.getTeam((await context.params).id));
}
