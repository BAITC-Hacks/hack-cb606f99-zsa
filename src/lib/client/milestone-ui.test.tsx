import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MilestonePanel } from "@/components/milestones";
import type { Milestone } from "@/shared/contracts";

// Vitest's plain JSX transform does not use Next.js's automatic JSX runtime.
beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());
const planned: Milestone = {
  id: "milestone-1", taskId: "task-1", proposalId: "proposal-1", teamId: "team-1",
  title: "Проверенный прототип", description: "Показать основной сценарий",
  points: 10, status: "planned", report: "", evidenceUrl: "", reviewComment: "", version: 1,
  createdAt: "2026-09-23T08:00:00.000Z", updatedAt: "2026-09-23T08:00:00.000Z",
  submittedAt: null, confirmedAt: null,
};
function render(mode: "business" | "team", milestone = planned, disabled = false) {
  return renderToStaticMarkup(React.createElement(MilestonePanel, {
    taskId: "task-1", proposalId: "proposal-1", milestones: [milestone], mode, disabled, onChanged: () => {},
  }));
}
describe("milestone UI action boundaries", () => {
  it("does not let a business confirm a stage before the team's report", () => {
    const html = render("business");
    expect(html).toContain("Добавить этап");
    expect(html).toContain("Ожидает отчёта команды");
    expect(html).not.toContain("Подтвердить выполнение");
    expect(html).not.toContain("Отправить отчёт на проверку");
  });
  it("offers report submission to the team but not review or stage creation", () => {
    const html = render("team");
    expect(html).toContain("Отправить отчёт на проверку");
    expect(html).not.toContain("Добавить этап");
    expect(html).not.toContain("Подтвердить выполнение");
  });
  it("only lets a business review submitted evidence", () => {
    const submitted: Milestone = { ...planned, status: "submitted", report: "Проверили сценарий", evidenceUrl: "https://example.com/demo", submittedAt: planned.createdAt, version: 2 };
    expect(render("business", submitted)).toContain("Подтвердить выполнение");
    expect(render("business", submitted)).toContain("Вернуть на доработку");
    expect(render("team", submitted)).not.toContain("Отправить отчёт на проверку");
    expect(render("team", submitted)).not.toContain("Подтвердить выполнение");
  });
  it("renders confirmed and disabled stages as read-only", () => {
    const confirmed: Milestone = { ...planned, status: "confirmed", report: "Готово", submittedAt: planned.createdAt, confirmedAt: planned.createdAt, version: 3 };
    const html = render("business", confirmed, true);
    expect(html).toContain("Повторное начисление невозможно");
    expect(html).not.toContain("Добавить этап");
    expect(html).not.toContain("Подтвердить выполнение");
    expect(render("team", planned, true)).not.toContain("Отправить отчёт на проверку");
  });
});
