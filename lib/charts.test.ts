import { describe, expect, it } from "vitest";

import { rangeChange, rangeLabel, rangeToInterval } from "./charts";
import type { Candle } from "./schemas";

const candle = (o: number, c: number, t = 0): Candle => ({ t, o, h: Math.max(o, c), l: Math.min(o, c), c, v: 1 });

describe("rangeToInterval", () => {
  it("maps each range to coarser candles, never more points", () => {
    expect(rangeToInterval("1h")).toEqual({ interval: "1m", count: 60, intervalMs: 60_000 });
    expect(rangeToInterval("4h")).toEqual({ interval: "5m", count: 48, intervalMs: 300_000 });
    expect(rangeToInterval("1d")).toEqual({ interval: "15m", count: 96, intervalMs: 900_000 });
    expect(rangeToInterval("1w")).toEqual({ interval: "1h", count: 168, intervalMs: 3_600_000 });
  });

  it("covers exactly the range it names", () => {
    for (const [range, ms] of [["1h", 3_600_000], ["4h", 14_400_000], ["1d", 86_400_000], ["1w", 604_800_000]] as const) {
      const spec = rangeToInterval(range);
      expect(spec.count * spec.intervalMs).toBe(ms);
    }
  });

  it("speaks the range in plain words", () => {
    expect(rangeLabel("1h")).toBe("last hour");
    expect(rangeLabel("1w")).toBe("last week");
  });
});

describe("rangeChange", () => {
  it("measures from the first open to the last close, with sign", () => {
    expect(rangeChange([candle(80_000, 80_200), candle(80_200, 80_400)])).toEqual({ abs: 400, pct: 0.5 });
    expect(rangeChange([candle(100, 99), candle(99, 98)])).toEqual({ abs: -2, pct: -2 });
  });

  it("is null without candles or with a zero open", () => {
    expect(rangeChange([])).toBeNull();
    expect(rangeChange([candle(0, 1)])).toBeNull();
  });
});
