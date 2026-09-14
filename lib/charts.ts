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

/**
 * Time left until the current bar closes, as a terminal shows it: "4:07" under
 * an hour, "2h 15m" over it, and "closing" once the bar is due — a bar whose
 * close has passed is simply waiting for the next poll, never a negative clock.
 */
export function countdownLabel(msLeft: number): string {
  if (!Number.isFinite(msLeft) || msLeft <= 0) return "closing";
  const totalSeconds = Math.ceil(msLeft / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

/**
 * How far beyond the candles' own range a level may sit and still be folded
 * into the price scale, as a multiple of that range (design D5).
 */
export const LEVEL_SCALE_FACTOR = 1.5;

/**
 * Splits an idea's levels into the ones that belong on the price scale and the
 * ones that would flatten the candles into a line if they were included.
 *
 * Forcing every level into view is what turned a card with a −50 % stop loss
 * into a flat line: the scale stretched to 40,000 and the hour of candles
 * collapsed into one pixel. A level further than `factor` times the candles'
 * own range is left off the scale instead, and the caller reports it in the
 * caption rather than drawing it.
 *
 * Generic over `{ price }` so it can take chart lines without this module
 * having to know what a chart line is.
 */
export function splitLevels<T extends { price: number }>(
  candles: Candle[],
  levels: T[],
  factor = LEVEL_SCALE_FACTOR,
): { inScale: T[]; above: T[]; below: T[] } {
  const all = { inScale: levels, above: [] as T[], below: [] as T[] };
  if (candles.length === 0 || levels.length === 0) return all;

  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const candle of candles) {
    if (Number.isFinite(candle.l) && candle.l < lo) lo = candle.l;
    if (Number.isFinite(candle.h) && candle.h > hi) hi = candle.h;
  }
  const span = hi - lo;
  // No usable range (no finite candles, or a market that has not moved at all):
  // there is nothing to flatten, so nothing is excluded.
  if (!Number.isFinite(span) || span <= 0) return all;

  const floor = lo - factor * span;
  const ceiling = hi + factor * span;
  const inScale: T[] = [];
  const above: T[] = [];
  const below: T[] = [];
  for (const level of levels) {
    if (!Number.isFinite(level.price)) continue;
    if (level.price > ceiling) above.push(level);
    else if (level.price < floor) below.push(level);
    else inScale.push(level);
  }
  return { inScale, above, below };
}

/** Change from the first open to the last close of the candles shown; null without data. */
export function rangeChange(candles: Candle[]): { abs: number; pct: number } | null {
  const first = candles[0];
  const last = candles[candles.length - 1];
  if (!first || !last || first.o <= 0) return null;
  const abs = last.c - first.o;
  return { abs, pct: (abs / first.o) * 100 };
}
