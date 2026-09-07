import { describe as suite, expect, it } from "vitest";

import {
  crossedALevel,
  describe,
  groupCopyMarkers,
  headline,
  holdLabel,
  ideaProgress,
  isExpired,
  progressSentence,
  spreadLabels,
  timeLeftLabel,
  tpSlPrices,
} from "./math";

// The spec example: Up on BTC, entry 80,000, TP +3 % (82,400), SL −2 % (78,400).
const UP = { side: "up" as const, entryPrice: 80_000, tpPrice: 82_400, slPrice: 78_400 };
// Its mirror: Down, TP 77,600, SL 81,600.
const DOWN = { side: "down" as const, entryPrice: 80_000, tpPrice: 77_600, slPrice: 81_600 };

suite("tpSlPrices", () => {
  it("puts TP above and SL below the entry for an Up idea", () => {
    expect(tpSlPrices("up", 80_000, 3, 2)).toEqual({ tpPrice: 82_400, slPrice: 78_400 });
  });

  it("mirrors the sides for a Down idea", () => {
    expect(tpSlPrices("down", 80_000, 3, 2)).toEqual({ tpPrice: 77_600, slPrice: 81_600 });
  });
});

suite("isExpired", () => {
  it("is false before and true at/after expiry", () => {
    expect(isExpired({ expiresAt: 1_000 }, 999)).toBe(false);
    expect(isExpired({ expiresAt: 1_000 }, 1_000)).toBe(true);
    expect(isExpired({ expiresAt: 1_000 }, 5_000)).toBe(true);
  });
});

suite("labels", () => {
  it("holdLabel speaks in hours, days and minutes", () => {
    expect(holdLabel(4)).toBe("4 hours");
    expect(holdLabel(1)).toBe("1 hour");
    expect(holdLabel(48)).toBe("2 days");
    expect(holdLabel(0.5)).toBe("30 minutes");
  });

  it("timeLeftLabel counts down and says expired", () => {
    expect(timeLeftLabel({ expiresAt: 3 * 3_600_000 }, 0)).toBe("3h left");
    expect(timeLeftLabel({ expiresAt: 20 * 60_000 }, 0)).toBe("20m left");
    expect(timeLeftLabel({ expiresAt: 0 }, 1)).toBe("expired");
  });

  it("headline and describe use plain words", () => {
    expect(headline({ market: "BTC/USD", side: "up" })).toBe("went Up on BTC");
    expect(
      describe({ author: "Ana", market: "BTC/USD", side: "up", entryPrice: 80_000, tpPrice: 82_400, slPrice: 78_400, holdHours: 4, size: 0.00002 }),
    ).toBe("Ana thinks BTC goes up: in at $80,000, out at $82,400 or $78,400, for 4 hours.");
  });

  it("conjugates for the default name You", () => {
    expect(
      describe({ author: "You", market: "AMZN/USD", side: "down", entryPrice: 259, tpPrice: 233, slPrice: 261, holdHours: 8, size: 0.01 }),
    ).toBe("You think AMZN goes down: in at $259, out at $233 or $261, for 8 hours.");
  });
});

suite("ideaProgress", () => {
  it("puts the entry at slPct / (tpPct + slPct) for Up and Down alike", () => {
    expect(ideaProgress(UP, null).entryPos).toBeCloseTo(0.4, 10);
    expect(ideaProgress(DOWN, null).entryPos).toBeCloseTo(0.4, 10);
  });

  it("places the spec example a quarter of the way from the entry to the take profit", () => {
    const p = ideaProgress(UP, 80_600);
    expect(p.state).toBe("toward-tp");
    expect(p.nowPos).toBeCloseTo(0.55, 10);
    expect(((p.nowPos ?? 0) - p.entryPos) / (1 - p.entryPos)).toBeCloseTo(0.25, 10);
  });

  it("moves right as a Down idea's price falls", () => {
    const higher = ideaProgress(DOWN, 80_800);
    const lower = ideaProgress(DOWN, 79_000);
    expect(higher.state).toBe("toward-sl");
    expect(lower.state).toBe("toward-tp");
    expect(lower.nowPos ?? 0).toBeGreaterThan(higher.nowPos ?? 0);
  });

  it("clamps past the take profit and past the stop loss", () => {
    expect(ideaProgress(UP, 90_000)).toMatchObject({ nowPos: 1, state: "beyond-tp" });
    expect(ideaProgress(UP, 70_000)).toMatchObject({ nowPos: 0, state: "beyond-sl" });
    expect(ideaProgress(DOWN, 70_000)).toMatchObject({ nowPos: 1, state: "beyond-tp" });
  });

  it("treats ±0.2 % of the entry as right at the entry", () => {
    expect(ideaProgress(UP, 80_100).state).toBe("at-entry");
    expect(ideaProgress(UP, 80_200).state).toBe("toward-tp");
    expect(ideaProgress(UP, 79_850).state).toBe("at-entry");
  });

  it("has no now marker without a price", () => {
    expect(ideaProgress(UP, null)).toMatchObject({ nowPos: null, state: "unknown" });
    expect(ideaProgress(UP, 0)).toMatchObject({ nowPos: null, state: "unknown" });
    expect(ideaProgress(UP, Number.NaN)).toMatchObject({ nowPos: null, state: "unknown" });
  });
});

suite("progressSentence", () => {
  it("says where the price is in plain words", () => {
    expect(progressSentence(UP, 80_600)).toBe("now $80,600 · on its way to the take profit");
    expect(progressSentence(UP, 79_200)).toBe("now $79,200 · slipping toward the stop loss");
    expect(progressSentence(UP, 80_010)).toBe("now $80,010 · right at the entry");
    expect(progressSentence(UP, 90_000)).toBe("now $90,000 · past the take profit");
    expect(progressSentence(UP, 70_000)).toBe("now $70,000 · past the stop loss");
  });

  it("uses two decimals for small prices", () => {
    const ada = { side: "up" as const, entryPrice: 0.5, tpPrice: 0.515, slPrice: 0.49 };
    expect(progressSentence(ada, 0.51)).toBe("now $0.51 · on its way to the take profit");
  });

  it("explains a missing price and an ended idea", () => {
    expect(progressSentence(UP, null)).toBe("live price unavailable");
    expect(progressSentence({ ...UP, expired: true }, 80_600)).toBe("this idea has ended");
  });
});

suite("crossedALevel", () => {
  const open = { ...UP, outcome: null, expired: false };

  it("sees an Up idea reach either level", () => {
    expect(crossedALevel(open, 82_400)).toBe(true); // exactly the take profit
    expect(crossedALevel(open, 82_500)).toBe(true);
    expect(crossedALevel(open, 78_400)).toBe(true); // exactly the stop loss
    expect(crossedALevel(open, 78_000)).toBe(true);
  });

  it("mirrors the sides for a Down idea", () => {
    const down = { ...DOWN, outcome: null, expired: false };
    expect(crossedALevel(down, 77_600)).toBe(true); // take profit is below
    expect(crossedALevel(down, 81_600)).toBe(true); // stop loss is above
    expect(crossedALevel(down, 80_000)).toBe(false);
  });

  it("says no while the price is between the levels", () => {
    expect(crossedALevel(open, 80_000)).toBe(false);
    expect(crossedALevel(open, 82_399)).toBe(false);
    expect(crossedALevel(open, 78_401)).toBe(false);
  });

  it("says no for an idea that is already finished", () => {
    expect(crossedALevel({ ...open, outcome: "tp" }, 82_500)).toBe(false);
    expect(crossedALevel({ ...open, expired: true }, 82_500)).toBe(false);
  });

  it("says no for a price it would not trust", () => {
    expect(crossedALevel(open, 0)).toBe(false);
    expect(crossedALevel(open, -1)).toBe(false);
    expect(crossedALevel(open, Number.NaN)).toBe(false);
  });
});

suite("spreadLabels", () => {
  it("leaves well-separated labels alone and keeps input order", () => {
    expect(spreadLabels([10, 50, 90], 10, 0, 100)).toEqual([10, 50, 90]);
    expect(spreadLabels([90, 10], 10, 0, 100)).toEqual([90, 10]);
  });

  it("pushes a label that sits on another one down by the gap", () => {
    // Take profit at 20, entry and stop loss both near 60 (a tight stop).
    expect(spreadLabels([20, 60, 62], 10, 0, 100)).toEqual([20, 60, 70]);
  });

  it("walks back from the bottom edge instead of overflowing", () => {
    expect(spreadLabels([95, 97, 99], 10, 0, 100)).toEqual([80, 90, 100]);
  });

  it("never goes above the top edge", () => {
    expect(spreadLabels([0, 1], 10, 0, 100)).toEqual([0, 10]);
  });
});

suite("groupCopyMarkers", () => {
  const minute = 60_000;

  it("names one or two copiers and counts three or more", () => {
    expect(groupCopyMarkers([{ copier: "Ben", createdAt: 5 * minute + 10 }])).toEqual([{ time: 5 * minute, label: "Ben copied" }]);
    expect(
      groupCopyMarkers([
        { copier: "Ben", createdAt: 5 * minute + 10 },
        { copier: "Cid", createdAt: 5 * minute + 40_000 },
      ]),
    ).toEqual([{ time: 5 * minute, label: "Ben, Cid copied" }]);
    expect(
      groupCopyMarkers([
        { copier: "Dee", createdAt: 7 * minute },
        { copier: "Eve", createdAt: 7 * minute + 1 },
        { copier: "Fay", createdAt: 7 * minute + 2 },
      ]),
    ).toEqual([{ time: 7 * minute, label: "3 copied" }]);
  });

  it("clusters copies within ten minutes and keeps farther ones apart, sorted by time", () => {
    expect(
      groupCopyMarkers([
        { copier: "You", createdAt: 14 * minute },
        { copier: "Ben", createdAt: 5 * minute },
      ]),
    ).toEqual([{ time: 5 * minute, label: "Ben, You copied" }]);
    expect(
      groupCopyMarkers([
        { copier: "Cid", createdAt: 30 * minute },
        { copier: "Ben", createdAt: 5 * minute },
      ]),
    ).toEqual([
      { time: 5 * minute, label: "Ben copied" },
      { time: 30 * minute, label: "Cid copied" },
    ]);
    expect(groupCopyMarkers([])).toEqual([]);
  });
});
