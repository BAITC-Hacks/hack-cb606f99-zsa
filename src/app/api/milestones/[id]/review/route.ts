import { platform } from "@/server/bootstrap";
import { api, readJson, type IdContext } from "@/server/http";

export const runtime = "nodejs";

export function POST(request: Request, context: IdContext) {
  return api(async () => platform.reviewMilestone((await context.params).id, await readJson(request)));
}
