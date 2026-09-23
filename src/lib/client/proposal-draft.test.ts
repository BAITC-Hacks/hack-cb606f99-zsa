import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearProposalDraft, EMPTY_PROPOSAL, PROPOSAL_LIMITS,
  readProposalDraft, saveProposalDraft,
} from "./proposal-draft";

describe("unsent proposal recovery", () => {
  let values: Map<string, string>;
  beforeEach(() => {
    values = new Map();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("restores incomplete input only for its original task", () => {
    const draft = { ...EMPTY_PROPOSAL, solutionIdea: "Система записи", prototypeUrl: "https://" };
    saveProposalDraft("one", draft);
    expect(readProposalDraft("one")).toEqual(draft);
    expect(readProposalDraft("two")).toBeNull();
  });

  it("removes the backup after sending or clearing all text", () => {
    const draft = { ...EMPTY_PROPOSAL, plan: "Прототип" };
    saveProposalDraft("one", draft);
    clearProposalDraft("one");
    expect(readProposalDraft("one")).toBeNull();
    saveProposalDraft("one", draft);
    saveProposalDraft("one", { ...EMPTY_PROPOSAL, teamId: "selected-team" });
    expect(readProposalDraft("one")).toBeNull();
  });

  it("rejects corrupt and oversized backups", () => {
    values.set("taskhub-proposal-draft:one", "not-json");
    expect(readProposalDraft("one")).toBeNull();
    values.set("taskhub-proposal-draft:one", JSON.stringify({ ...EMPTY_PROPOSAL, plan: "x".repeat(PROPOSAL_LIMITS.plan + 1) }));
    expect(readProposalDraft("one")).toBeNull();
  });

  it("allows the API's full field lengths", () => {
    const draft = {
      ...EMPTY_PROPOSAL,
      solutionIdea: "a".repeat(5000), plan: "b".repeat(5000),
      estimatedDuration: "c".repeat(200), prototypeUrl: "d".repeat(2000),
    };
    saveProposalDraft("one", draft);
    expect(readProposalDraft("one")).toEqual(draft);
  });

  it("keeps the form usable when storage access is denied", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => { throw new Error("Denied"); },
      setItem: () => { throw new Error("Denied"); },
      removeItem: () => { throw new Error("Denied"); },
    });
    expect(readProposalDraft("one")).toBeNull();
    expect(() => saveProposalDraft("one", { ...EMPTY_PROPOSAL, plan: "План" })).not.toThrow();
    expect(() => clearProposalDraft("one")).not.toThrow();
  });
});
