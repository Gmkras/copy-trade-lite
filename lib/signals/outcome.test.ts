import { describe, expect, it } from "vitest";

import { outcomeLabel, outcomeShortLabel, settleAll, settleSignal, type Settleable } from "./outcome";
import type { Candle } from "../schemas";

const MINUTE = 60_000;
const CREATED = 1_000_000;
const EXPIRES = CREATED + 4 * 60 * MINUTE; // 4 hours

/** Up idea: entry 80,000, take profit 82,400 (+3 %), stop loss 78,400 (−2 %). */
const UP: Settleable = { side: "up", tpPrice: 82_400, slPrice: 78_400, createdAt: CREATED, expiresAt: EXPIRES };
/** Down idea: mirrored — take profit below the entry, stop loss above it. */
const DOWN: Settleable = { side: "down", tpPrice: 77_600, slPrice: 81_600, createdAt: CREATED, expiresAt: EXPIRES };

/** A candle at `t` with the given high and low; open/close sit between them. */
const candle = (t: number, h: number, l: number): Candle => ({ t, o: l, h, l, c: h, v: 1 });

describe("settleSignal", () => {
  it("marks tp when an Up idea's high reaches the take profit", () => {
    const candles = [candle(CREATED + MINUTE, 81_000, 80_000), candle(CREATED + 2 * MINUTE, 82_500, 81_000)];
    expect(settleSignal(UP, candles, CREATED + 3 * MINUTE)).toBe("tp");
  });

  it("marks sl when an Up idea's low reaches the stop loss", () => {
    const candles = [candle(CREATED + MINUTE, 80_100, 79_900), candle(CREATED + 2 * MINUTE, 79_000, 78_300)];
    expect(settleSignal(UP, candles, CREATED + 3 * MINUTE)).toBe("sl");
  });

  it("mirrors the sides for a Down idea", () => {
    const wins = [candle(CREATED + MINUTE, 80_000, 77_500)]; // low crosses the take profit
    expect(settleSignal(DOWN, wins, CREATED + 2 * MINUTE)).toBe("tp");
    const loses = [candle(CREATED + MINUTE, 81_700, 80_000)]; // high crosses the stop loss
    expect(settleSignal(DOWN, loses, CREATED + 2 * MINUTE)).toBe("sl");
  });

  it("takes the exact level as reached, not only beyond it", () => {
    expect(settleSignal(UP, [candle(CREATED + MINUTE, 82_400, 80_000)], CREATED + 2 * MINUTE)).toBe("tp");
    expect(settleSignal(UP, [candle(CREATED + MINUTE, 80_000, 78_400)], CREATED + 2 * MINUTE)).toBe("sl");
  });

  it("records sl when one candle reached both levels (the order is unknowable)", () => {
    const both = [candle(CREATED + MINUTE, 82_500, 78_300)];
    expect(settleSignal(UP, both, CREATED + 2 * MINUTE)).toBe("sl");
    expect(settleSignal(DOWN, [candle(CREATED + MINUTE, 81_700, 77_500)], CREATED + 2 * MINUTE)).toBe("sl");
  });

  it("stops at the first candle that decided it", () => {
    const candles = [
      candle(CREATED + MINUTE, 82_500, 80_000), // take profit here
      candle(CREATED + 2 * MINUTE, 79_000, 78_000), // stop loss later: must not win
    ];
    expect(settleSignal(UP, candles, CREATED + 3 * MINUTE)).toBe("tp");
  });

  it("marks expired when the hold ended with neither level reached", () => {
    const quiet = [candle(CREATED + MINUTE, 80_500, 79_500), candle(CREATED + 2 * MINUTE, 80_600, 79_800)];
    expect(settleSignal(UP, quiet, EXPIRES)).toBe("expired");
    expect(settleSignal(UP, quiet, EXPIRES + MINUTE)).toBe("expired");
  });

  it("leaves the idea open while the hold is still running", () => {
    const quiet = [candle(CREATED + MINUTE, 80_500, 79_500)];
    expect(settleSignal(UP, quiet, CREATED + 2 * MINUTE)).toBeNull();
    expect(settleSignal(UP, [], CREATED + 2 * MINUTE)).toBeNull();
  });

  it("expires with no candles at all once the deadline passed", () => {
    expect(settleSignal(UP, [], EXPIRES + MINUTE)).toBe("expired");
  });

  it("ignores candles from before the idea was posted", () => {
    const before = [candle(CREATED - MINUTE, 90_000, 70_000)]; // crossed everything, but earlier
    expect(settleSignal(UP, before, CREATED + MINUTE)).toBeNull();
  });

  it("ignores candles after the hold ended", () => {
    const after = [candle(EXPIRES + MINUTE, 90_000, 80_000)];
    expect(settleSignal(UP, after, EXPIRES + 2 * MINUTE)).toBe("expired");
  });
});

describe("settleAll", () => {
  const idea = (id: string, market: string, createdAt: number, outcome: "tp" | "sl" | "expired" | null = null) => ({
    ...UP, id, market, createdAt, expiresAt: createdAt + 4 * 60 * MINUTE, outcome,
  });

  it("reads one series per market, from its oldest open idea", async () => {
    const calls: { market: string; since: number }[] = [];
    const deps = { getCandlesSince: async (market: string, since: number) => { calls.push({ market, since }); return []; } };
    await settleAll(
      [idea("a", "BTC/USD", CREATED + 5 * MINUTE), idea("b", "BTC/USD", CREATED), idea("c", "ETH/USD", CREATED)],
      CREATED + MINUTE,
      deps,
    );
    expect(calls).toHaveLength(2);
    expect(calls.find((c) => c.market === "BTC/USD")?.since).toBe(CREATED); // the oldest one
  });

  it("does not read anything for ideas that are already settled", async () => {
    const calls: string[] = [];
    const deps = { getCandlesSince: async (market: string) => { calls.push(market); return []; } };
    const changed = await settleAll([idea("a", "BTC/USD", CREATED, "tp")], CREATED + MINUTE, deps);
    expect(calls).toEqual([]);
    expect(changed).toEqual([]);
  });

  it("returns only the ideas that changed", async () => {
    const deps = { getCandlesSince: async () => [candle(CREATED + MINUTE, 82_500, 80_000)] };
    const changed = await settleAll(
      [idea("won", "BTC/USD", CREATED), idea("open", "BTC/USD", CREATED + 10 * MINUTE)],
      CREATED + 2 * MINUTE,
      deps,
    );
    expect(changed).toEqual([{ id: "won", outcome: "tp" }]);
  });

  it("leaves a market's ideas open when its candles cannot be read, without throwing", async () => {
    const deps = {
      getCandlesSince: async (market: string) => {
        if (market === "ETH/USD") throw new Error("upstream 502");
        return [candle(CREATED + MINUTE, 82_500, 80_000)];
      },
    };
    const changed = await settleAll(
      [idea("btc", "BTC/USD", CREATED), idea("eth", "ETH/USD", CREATED)],
      CREATED + 2 * MINUTE,
      deps,
    );
    expect(changed).toEqual([{ id: "btc", outcome: "tp" }]);
  });

  it("does nothing when every idea is settled", async () => {
    const deps = { getCandlesSince: async () => { throw new Error("must not be called"); } };
    await expect(settleAll([idea("a", "BTC/USD", CREATED, "expired")], CREATED, deps)).resolves.toEqual([]);
  });
});

describe("outcomeLabel", () => {
  it("says the result in plain words and names the level", () => {
    expect(outcomeLabel("tp")).toEqual({ text: "✅ It worked · hit the take profit", tone: "up" });
    expect(outcomeLabel("sl")).toEqual({ text: "❌ It didn't work · hit the stop loss", tone: "down" });
    expect(outcomeLabel("expired")).toEqual({ text: "⏱ Time ran out · neither level reached", tone: "muted" });
  });

  it("has no label while the idea is open", () => {
    expect(outcomeLabel(null)).toBeNull();
    expect(outcomeShortLabel(null)).toBeNull();
  });

  it("uses no exchange jargon a child would not know", () => {
    for (const outcome of ["tp", "sl", "expired"] as const) {
      expect(outcomeLabel(outcome)?.text).not.toMatch(/\b(long|short|IOC|bps|margin|leverage)\b/i);
    }
  });
});
