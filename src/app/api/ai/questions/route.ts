import { ai } from "@/server/bootstrap";
import { api, readJson } from "@/server/http";

export const runtime = "nodejs";
export function POST(request: Request) {
  return api(async () => ai.analyze(await readJson(request)));
}
