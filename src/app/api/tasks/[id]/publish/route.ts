import { platform } from "@/server/bootstrap";
import { api, readJson, type IdContext } from "@/server/http";

export const runtime = "nodejs";
export function POST(request: Request, context: IdContext) {
  return api(async () => platform.publishTask((await context.params).id, await readJson(request)));
}
