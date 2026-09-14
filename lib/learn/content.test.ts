import { describe, expect, it } from "vitest";

import { MEMORY_STEPS, QUIZ } from "./content";

describe("MEMORY_STEPS", () => {
  it("starts and ends with an empty stack", () => {
    expect(MEMORY_STEPS[0]?.stack).toEqual([]);
    expect(MEMORY_STEPS[MEMORY_STEPS.length - 1]?.stack).toEqual([]);
  });

  it("only ever pushes or pops at the top, one frame at a time", () => {
    for (let i = 1; i < MEMORY_STEPS.length; i += 1) {
      const before = MEMORY_STEPS[i - 1]?.stack ?? [];
      const after = MEMORY_STEPS[i]?.stack ?? [];
      expect(Math.abs(after.length - before.length)).toBeLessThanOrEqual(1);
      // Whatever stays must stay in place: a stack never reorders.
      const kept = Math.min(before.length, after.length);
      for (let f = 0; f < kept; f += 1) {
        expect(after[f]?.fn).toBe(before[f]?.fn);
      }
    }
  });

  it("pops every frame it pushes", () => {
    const pushed = new Set<string>();
    for (const step of MEMORY_STEPS) for (const frame of step.stack) pushed.add(frame.fn);
    expect(pushed.size).toBeGreaterThan(0);
    // The last step is empty, so nothing is left behind.
    expect(MEMORY_STEPS[MEMORY_STEPS.length - 1]?.stack).toHaveLength(0);
  });

  it("names the real call path this app uses to send an order", () => {
    const seen = new Set<string>();
    for (const step of MEMORY_STEPS) for (const frame of step.stack) seen.add(frame.fn);
    expect([...seen].sort()).toEqual(["floorToLot", "placeMarketOrder", "toChainUnits", "toValidOrderSize"]);
  });

  it("keeps the heap object after the frame that allocated it has gone", () => {
    const last = MEMORY_STEPS[MEMORY_STEPS.length - 1];
    expect(last?.stack).toHaveLength(0);
    expect(last?.heap).toHaveLength(1);
    expect(last?.heap[0]?.reachable).toBe(false);
  });

  it("gives every step a caption", () => {
    for (const step of MEMORY_STEPS) expect(step.caption.length).toBeGreaterThan(10);
  });
});

describe("QUIZ", () => {
  it("asks six questions", () => {
    expect(QUIZ).toHaveLength(6);
  });

  it("gives every question one correct answer that exists", () => {
    for (const q of QUIZ) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.correct).toBeGreaterThanOrEqual(0);
      expect(q.correct).toBeLessThan(q.options.length);
    }
  });

  it("has no duplicate options within a question", () => {
    for (const q of QUIZ) expect(new Set(q.options).size).toBe(q.options.length);
  });

  it("uses unique ids, so React keys and answers cannot collide", () => {
    expect(new Set(QUIZ.map((q) => q.id)).size).toBe(QUIZ.length);
  });

  it("explains every question, right or wrong", () => {
    for (const q of QUIZ) expect(q.explanation.length).toBeGreaterThan(20);
  });

  it("covers all three sections", () => {
    const ids = QUIZ.map((q) => q.id).join(" ");
    expect(ids).toContain("where-array");
    expect(ids).toContain("overflow");
    expect(ids).toContain("protocol");
  });
});
