import { describe, expect, it } from "vitest";

import { MAX_TASK_SCORE, SCORING_DIMENSIONS } from "./scoring";

describe("task readiness scoring configuration", () => {
  it("adds up to 100 points", () => {
    expect(MAX_TASK_SCORE).toBe(100);
  });

  it("does not contain duplicate keys", () => {
    const keys = SCORING_DIMENSIONS.map((dimension) => dimension.key);

    expect(new Set(keys).size).toBe(keys.length);
  });
});
