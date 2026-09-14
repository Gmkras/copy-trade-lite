import { describe, expect, it } from "vitest";

import { compact, everyLabel } from "./format";

describe("compact", () => {
  it("shortens thousands, millions and billions", () => {
    expect(compact(223_840.457)).toBe("223.8K");
    expect(compact(2_300_000)).toBe("2.3M");
    expect(compact(2_300_000_000)).toBe("2.3B");
  });

  it("leaves small figures readable", () => {
    expect(compact(1_019.64)).toBe("1.0K");
    expect(compact(42.5)).toBe("42.5");
  });

  it("keeps the sign", () => {
    expect(compact(-5_400)).toBe("-5.4K");
  });

  it("shows a dash rather than NaN", () => {
    expect(compact(Number.NaN)).toBe("—");
  });
});

describe("everyLabel", () => {
  it("prefers whole hours, then minutes", () => {
    expect(everyLabel(3_600)).toBe("1h");
    expect(everyLabel(28_800)).toBe("8h");
    expect(everyLabel(900)).toBe("15m");
  });

  it("falls back to seconds, and to a dash for nonsense", () => {
    expect(everyLabel(45)).toBe("45s");
    expect(everyLabel(0)).toBe("—");
    expect(everyLabel(Number.NaN)).toBe("—");
  });
});
