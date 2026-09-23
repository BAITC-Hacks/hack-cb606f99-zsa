import { describe, expect, it, vi } from "vitest";
import { CreateTaskRequestSchema } from "../shared/contracts";
import { api, queryParams, readJson } from "./http";

const request = (body: string, headers = { "Content-Type": "application/json" }) => new Request("http://localhost/api/tasks", { method: "POST", body, headers });
describe("HTTP boundary", () => {
  it("returns consistent validation and malformed JSON errors", async () => {
    const malformed = await api(() => readJson(request("{")));
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error.code).toBe("INVALID_JSON");
    const invalid = await api(async () => CreateTaskRequestSchema.parse(await readJson(request("{}"))));
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error.details[0].path).toBe("initialDescription");
  });
  it("rejects oversized bodies, unsupported media types and duplicate query parameters", async () => {
    expect((await api(() => readJson(request("x".repeat(65537))))).status).toBe(413);
    expect((await api(() => readJson(request("{}", { "Content-Type": "text/plain" })))).status).toBe(415);
    expect(() => queryParams(new Request("http://localhost/api/tasks?status=draft&status=all"))).toThrow();
  });
  it("hides internal errors and disables response caching", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await api(async () => { throw new Error("Secret filesystem path or key"); });
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain("Secret");
      expect(response.headers.get("cache-control")).toBe("no-store");
    } finally { log.mockRestore(); }
  });
});
