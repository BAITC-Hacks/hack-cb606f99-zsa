import { ZodError } from "zod";
import { AppError } from "./errors";

export type IdContext = { params: Promise<{ id: string }> };
const MAX_BODY_BYTES = 64 * 1024;

export async function readJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Используйте Content-Type: application/json.");
  }
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
    throw new AppError(413, "BODY_TOO_LARGE", "Максимальный размер JSON — 64 КБ.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, "INVALID_JSON", "Ожидается тело JSON.");
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new AppError(413, "BODY_TOO_LARGE", "Максимальный размер JSON — 64 КБ.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new AppError(400, "INVALID_JSON", "Некорректное тело JSON."); }
}

export function queryParams(request: Request) {
  const params = new URL(request.url).searchParams;
  for (const key of params.keys()) {
    if (params.getAll(key).length > 1) throw new AppError(400, "VALIDATION_ERROR", `Параметр ${key} повторяется.`);
  }
  return Object.fromEntries(params);
}

export async function api(action: () => Promise<unknown>, status = 200): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };
  try { return Response.json(await action(), { status, headers }); }
  catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: { code: "VALIDATION_ERROR", message: "Проверьте поля запроса.",
        details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      } }, { status: 400, headers });
    }
    if (error instanceof AppError) {
      return Response.json({ error: { code: error.code, message: error.message, details: error.details } }, { status: error.status, headers });
    }
    // Do not expose payloads, API keys or filesystem paths in HTTP responses or logs.
    console.error("API request failed:", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: { code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера.", details: [] } }, { status: 500, headers });
  }
}
