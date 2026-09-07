/**
 * Pure chart helpers shared by the server routes and the client components.
 * No SDK, no network, no secrets (unit-tested).
 */
import type { Candle, CandleRange } from "./schemas";

/** The candle intervals this app asks the exchange for. */
export type CandleInterval = "1m" | "5m" | "15m" | "1h";

export type RangeSpec = {
  interval: CandleInterval;
  /** How many candles cover the range. */
  count: number;
  /** Length of one candle in milliseconds. */
  intervalMs: number;
};

const MINUTE = 60_000;

/**
 * A longer range means coarser candles, not more of them: an hour of minutes,
 * four hours of five-minute candles, a day of quarter-hours, a week of hours.
 */
export function rangeToInterval(range: CandleRange): RangeSpec {
  switch (range) {
    case "1h":
      return { interval: "1m", count: 60, intervalMs: MINUTE };
    case "4h":
      return { interval: "5m", count: 48, intervalMs: 5 * MINUTE };
    case "1d":
      return { interval: "15m", count: 96, intervalMs: 15 * MINUTE };
    case "1w":
      return { interval: "1h", count: 168, intervalMs: 60 * MINUTE };
  }
}

/**
 * The interval to use for a span of history: coarse enough that a week is not
 * ten thousand points, fine enough to see the shape. An aggregated candle keeps
 * the extremes of its period, so a coarser interval never hides a level being
 * reached — only the order of two crossings inside one candle (see
 * `lib/signals/outcome.ts`).
 */
export function intervalForSpan(spanMs: number): CandleInterval {
  const HOUR = 60 * MINUTE;
  if (spanMs <= 4 * HOUR) return "1m";
  if (spanMs <= 24 * HOUR) return "5m";
  if (spanMs <= 7 * 24 * HOUR) return "15m";
  return "1h";
}

/** Plain, short words for the range, for "+0.4% · last hour" next to the price. */
export function rangeLabel(range: CandleRange): string {
  switch (range) {
    case "1h":
      return "last hour";
    case "4h":
      return "last 4 hours";
    case "1d":
      return "last day";
    case "1w":
      return "last week";
  }
}

/** Change from the first open to the last close of the candles shown; null without data. */
export function rangeChange(candles: Candle[]): { abs: number; pct: number } | null {
  const first = candles[0];
  const last = candles[candles.length - 1];
  if (!first || !last || first.o <= 0) return null;
  const abs = last.c - first.o;
  return { abs, pct: (abs / first.o) * 100 };
}
