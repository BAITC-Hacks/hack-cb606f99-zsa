import { describe, expect, it } from "vitest";
import { emptyTaskFields, TASK_FIELDS } from "../../shared/contracts";
import { createSeed } from "../repositories/seed";
import { calculateReadiness, readinessLevel } from "./readiness";

describe("readiness", () => {
  it.each([[0, "draft"], [39, "draft"], [40, "workable"], [69, "workable"], [70, "ready"], [89, "ready"], [90, "priority"], [100, "priority"]] as const)(
    "%i belongs to %s", (score, level) => expect(readinessLevel(score)).toBe(level),
  );
  it("does not award points for generated or unconfirmed facts", () => {
    const full = createSeed().tasks[0];
    expect(calculateReadiness(full, []).score).toBe(0);
    const confirmed = calculateReadiness(full, [...TASK_FIELDS]);
    expect(confirmed.score).toBe(100);
    expect(confirmed.missingFields).toEqual([]);
    expect(confirmed.unconfirmedFields).toEqual([]);
  });
  it("requires both contact and feedback format for business connection points", () => {
    const fields = { ...emptyTaskFields("Описание тестовой задачи"), businessContact: "demo@example.com", interactionFormat: "Еженедельная встреча" };
    expect(calculateReadiness(fields, ["businessContact"]).score).toBe(0);
    expect(calculateReadiness(fields, ["businessContact", "interactionFormat"]).score).toBe(10);
  });
  it("never rewards blank fields even if the confirmation list includes them", () => {
    const readiness = calculateReadiness(emptyTaskFields("Описание тестовой задачи"), [...TASK_FIELDS]);
    expect(readiness.score).toBe(0);
    expect(readiness.missingFields).toContain("successCriteria");
    expect(readiness.scoreBreakdown.every((item) => item.explanation)).toBe(true);
  });
});
