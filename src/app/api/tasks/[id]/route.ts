import { platform } from "@/server/bootstrap";
import { api, readJson, type IdContext } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(_request: Request, context: IdContext) {
  return api(async () => platform.getTask((await context.params).id));
}
export function PATCH(request: Request, context: IdContext) {
  return api(async () => platform.updateTask((await context.params).id, await readJson(request)));
}
