import { platform } from "@/server/bootstrap";
import { api, queryParams, readJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return api(() => platform.listTasks(queryParams(request)));
}
export function POST(request: Request) {
  return api(async () => platform.createTask(await readJson(request)), 201);
}
