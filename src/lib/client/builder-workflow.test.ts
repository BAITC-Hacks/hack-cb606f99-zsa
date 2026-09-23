import { describe, expect, it, vi } from "vitest";
import { emptyTaskFields, type TaskCard } from "@/shared/contracts";
import { readinessPreview } from "./model";
import {
  canSaveDraft,
  fieldMaxLength,
  publishSavedCard,
  validBuilderDescription,
} from "./builder-workflow";

const source = "Нужно наладить учёт заявок сервисного центра";
function savedCard(status: TaskCard["status"]): TaskCard {
  const fields = { ...emptyTaskFields(source), title: "Учёт заявок" };
  return {
    ...fields,
    ...readinessPreview(fields, ["title"]),
    id: "task-draft",
    status,
    confirmedFields: ["title"],
    version: 7,
    createdAt: "2026-09-23T00:00:00.000Z",
    updatedAt: "2026-09-23T00:00:00.000Z",
    publishedAt: status === "published" ? "2026-09-23T00:00:00.000Z" : null,
  };
}

describe("builder API boundaries", () => {
  it("allows saving an unnamed draft without allowing invalid source data", () => {
    expect(canSaveDraft(emptyTaskFields(source))).toBe(true);
    expect(canSaveDraft(emptyTaskFields("коротко"))).toBe(false);
    expect(canSaveDraft(emptyTaskFields(" ".repeat(20)))).toBe(false);
  });

  it("accepts API-size fields and rejects the next character", () => {
    for (const [field, length] of [
      ["initialDescription", 10000],
      ["title", 200],
      ["topic", 200],
      ["businessContact", 200],
      ["expectedResult", 5000],
    ] as const) {
      expect(fieldMaxLength(field)).toBe(length);
      expect(canSaveDraft({ ...emptyTaskFields(source), [field]: "Я".repeat(length) })).toBe(true);
      expect(canSaveDraft({ ...emptyTaskFields(source), [field]: "Я".repeat(length + 1) })).toBe(false);
    }
    expect(validBuilderDescription("Я".repeat(10000))).toBe(true);
    expect(validBuilderDescription("Я".repeat(10001))).toBe(false);
  });

  it("publishes a saved draft using its latest server version", async () => {
    const draft = savedCard("draft");
    const published = { ...savedCard("published"), version: 8 };
    const publish = vi.fn().mockResolvedValue(published);
    expect(await publishSavedCard(draft, publish)).toBe(published);
    expect(publish).toHaveBeenCalledExactlyOnceWith(draft.id, 7);
  });

  it("does not turn a successful published update into a second request failure", async () => {
    const updated = savedCard("published");
    const publish = vi.fn().mockRejectedValue(new Error("Connection lost"));
    expect(await publishSavedCard(updated, publish)).toBe(updated);
    expect(publish).not.toHaveBeenCalled();
  });

  it("keeps a failed draft publication available for the existing retry flow", async () => {
    const publish = vi.fn().mockRejectedValue(new Error("Connection lost"));
    await expect(publishSavedCard(savedCard("draft"), publish)).rejects.toThrow("Connection lost");
  });
});
