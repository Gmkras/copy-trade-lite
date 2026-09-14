import { describe, expect, it } from "vitest";

import { countdownLabel, intervalForSpan, rangeChange, rangeLabel, rangeToInterval, splitLevels } from "./charts";
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

describe("intervalForSpan", () => {
  const HOUR = 3_600_000;

  it("gets coarser as the span grows, at the boundaries", () => {
    expect(intervalForSpan(30 * 60_000)).toBe("1m");
    expect(intervalForSpan(4 * HOUR)).toBe("1m");
    expect(intervalForSpan(4 * HOUR + 1)).toBe("5m");
    expect(intervalForSpan(24 * HOUR)).toBe("5m");
    expect(intervalForSpan(24 * HOUR + 1)).toBe("15m");
    expect(intervalForSpan(7 * 24 * HOUR)).toBe("15m");
    expect(intervalForSpan(7 * 24 * HOUR + 1)).toBe("1h");
    expect(intervalForSpan(30 * 24 * HOUR)).toBe("1h");
  });

  it("never asks for more than a few hundred candles", () => {
    for (const span of [HOUR, 4 * HOUR, 24 * HOUR, 7 * 24 * HOUR, 30 * 24 * HOUR]) {
      const ms = { "1m": 60_000, "5m": 300_000, "15m": 900_000, "1h": HOUR }[intervalForSpan(span)];
      expect(span / ms).toBeLessThanOrEqual(720);
    }
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

describe("splitLevels", () => {
  // An hour of BTC between 79,000 and 79,400: span 400, so the scale tolerates
  // 1.5 x 400 = 600 either side (78,400 .. 80,000).
  const hour: Candle[] = [candle(79_000, 79_200), candle(79_200, 79_400), candle(79_300, 79_100)];
  const level = (price: number, label = "") => ({ price, label });

  it("keeps a level inside the candles' own range", () => {
    const { inScale, above, below } = splitLevels(hour, [level(79_250, "Entry")]);
    expect(inScale.map((l) => l.label)).toEqual(["Entry"]);
    expect(above).toHaveLength(0);
    expect(below).toHaveLength(0);
  });

  it("keeps a level just outside, because that is the common take profit", () => {
    // +3 % of 79,400 is 81,782 — beyond the ceiling; +0.5 % is 79,797 — inside.
    expect(splitLevels(hour, [level(79_797)]).inScale).toHaveLength(1);
  });

  it("excludes a level far above and says which side it is on", () => {
    const { inScale, above } = splitLevels(hour, [level(120_000, "Take profit")]);
    expect(inScale).toHaveLength(0);
    expect(above.map((l) => l.label)).toEqual(["Take profit"]);
  });

  it("excludes the -50 % stop loss that used to flatten the card", () => {
    const { below, inScale } = splitLevels(hour, [level(79_100, "Entry"), level(39_546, "Stop loss")]);
    expect(below.map((l) => l.label)).toEqual(["Stop loss"]);
    expect(inScale.map((l) => l.label)).toEqual(["Entry"]);
  });

  it("excludes nothing when there are no candles to protect", () => {
    expect(splitLevels([], [level(1), level(1_000_000)]).inScale).toHaveLength(2);
  });

  it("excludes nothing when the market has not moved at all", () => {
    const flat: Candle[] = [candle(100, 100), candle(100, 100)];
    expect(splitLevels(flat, [level(500)]).inScale).toHaveLength(1);
  });

  it("returns empty lists for no levels", () => {
    expect(splitLevels(hour, [])).toEqual({ inScale: [], above: [], below: [] });
  });

  it("mirrors for a Down idea, whose take profit sits below", () => {
    const { below, inScale } = splitLevels(hour, [level(10_000, "Take profit"), level(79_500, "Stop loss")]);
    expect(below.map((l) => l.label)).toEqual(["Take profit"]);
    expect(inScale.map((l) => l.label)).toEqual(["Stop loss"]);
  });
});

describe("countdownLabel", () => {
  it("counts minutes and seconds under an hour", () => {
    expect(countdownLabel(4 * 60_000 + 7_000)).toBe("4:07");
    expect(countdownLabel(59_000)).toBe("0:59");
  });

  it("pads the seconds so the clock does not change width as it ticks", () => {
    expect(countdownLabel(65_000)).toBe("1:05");
  });

  it("switches to hours and minutes over an hour", () => {
    expect(countdownLabel(2 * 3_600_000 + 15 * 60_000)).toBe("2h 15m");
  });

  it("says closing rather than showing a negative clock", () => {
    expect(countdownLabel(0)).toBe("closing");
    expect(countdownLabel(-5_000)).toBe("closing");
  });

  it("says closing for a value that is not a number", () => {
    expect(countdownLabel(Number.NaN)).toBe("closing");
  });
});
