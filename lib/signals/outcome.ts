/**
 * How an idea ends: did the market reach its take profit, its stop loss, or
 * neither before the hold ran out?
 *
 * The decision is a pure function of the candles, so it is testable without the
 * SDK, without a clock and without the database. Settlement never reads fills
 * or positions: an idea nobody copied has none, and every idea must be judged
 * by the same rule.
 *
 * Client-safe (no Node APIs, no secrets): the components import `outcomeLabel`.
 */
import type { Candle, OrderSide } from "../schemas";

export type Outcome = "tp" | "sl" | "expired";

/** What `settleSignal` needs to judge an idea. */
export type Settleable = {
  side: OrderSide;
  tpPrice: number;
  slPrice: number;
  createdAt: number;
  expiresAt: number;
};

/**
 * The outcome of an idea given the market's candles, or `null` while it is
 * still open.
 *
 * Up: the take profit is above the entry, so a candle **high** reaching it is a
 * win and a candle **low** reaching the stop is a loss. Down is mirrored.
 *
 * When one candle reached both levels the order of the two moves inside it is
 * unknowable, and this returns `"sl"` — the reading that does not claim a win
 * the data cannot support (constitution S6, "don't fake it").
 */
export function settleSignal(signal: Settleable, candles: Candle[], now = Date.now()): Outcome | null {
  const deadline = Math.min(now, signal.expiresAt);
  const up = signal.side === "up";

  for (const candle of candles) {
    if (candle.t < signal.createdAt || candle.t > deadline) continue;
    const hitTp = up ? candle.h >= signal.tpPrice : candle.l <= signal.tpPrice;
    const hitSl = up ? candle.l <= signal.slPrice : candle.h >= signal.slPrice;
    // Both in one candle: we cannot know which came first, so we do not claim the win.
    if (hitSl) return "sl";
    if (hitTp) return "tp";
  }

  return now >= signal.expiresAt ? "expired" : null;
}

export type OutcomeTone = "up" | "down" | "muted";

/**
 * The badge a person reads. Plain words first, the trading term after, so a
 * child understands the result and an adult can still see which level it was
 * (constitution P2: plain words, never exchange jargon on its own).
 */
export function outcomeLabel(outcome: Outcome | null): { text: string; tone: OutcomeTone } | null {
  switch (outcome) {
    case "tp":
      return { text: "✅ It worked · hit the take profit", tone: "up" };
    case "sl":
      return { text: "❌ It didn't work · hit the stop loss", tone: "down" };
    case "expired":
      return { text: "⏱ Time ran out · neither level reached", tone: "muted" };
    default:
      return null;
  }
}

/** Short version for tight spots, same words: "✅ It worked". */
export function outcomeShortLabel(outcome: Outcome | null): string | null {
  switch (outcome) {
    case "tp":
      return "✅ It worked";
    case "sl":
      return "❌ It didn't work";
    case "expired":
      return "⏱ Time ran out";
    default:
      return null;
  }
}

/** An idea with an outcome is finished: it cannot be copied any more. */
export function isSettled(signal: { outcome: Outcome | null }): boolean {
  return signal.outcome !== null;
}

/* ----- Settling many ideas with as few reads as possible ----- */

type SettleInput = Settleable & { id: string; market: string; outcome: Outcome | null };

export type SettleDeps = {
  /** Every candle of `market` since `sinceMs`, ascending. */
  getCandlesSince: (market: string, sinceMs: number) => Promise<Candle[]>;
};

/**
 * Decides the outcome of every idea that still has none, reading **one candle
 * series per market** (from the oldest unsettled idea of that market) instead
 * of one per idea. A market whose candles cannot be read leaves its ideas open
 * and is logged; it never throws, because a feed must render even when the
 * exchange does not answer.
 *
 * Returns only the ideas that changed, so the caller writes the minimum.
 */
export async function settleAll<T extends SettleInput>(
  signals: T[],
  now: number,
  deps: SettleDeps,
): Promise<{ id: string; outcome: Outcome }[]> {
  const open = signals.filter((s) => s.outcome === null);
  if (open.length === 0) return [];

  const oldestByMarket = new Map<string, number>();
  for (const signal of open) {
    const current = oldestByMarket.get(signal.market);
    if (current === undefined || signal.createdAt < current) oldestByMarket.set(signal.market, signal.createdAt);
  }

  const markets = [...oldestByMarket.keys()];
  const series = await Promise.allSettled(
    markets.map((market) => deps.getCandlesSince(market, oldestByMarket.get(market) as number)),
  );

  const candlesByMarket = new Map<string, Candle[]>();
  series.forEach((result, i) => {
    const market = markets[i] as string;
    if (result.status === "fulfilled") candlesByMarket.set(market, result.value);
    else console.warn(`[outcome] no candles for ${market}, leaving its ideas open:`, result.reason);
  });

  const settled: { id: string; outcome: Outcome }[] = [];
  for (const signal of open) {
    const candles = candlesByMarket.get(signal.market);
    if (!candles) continue; // market unreadable: stays open, no guess
    const outcome = settleSignal(signal, candles, now);
    if (outcome) settled.push({ id: signal.id, outcome });
  }
  return settled;
}
