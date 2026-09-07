/** Pure signal math and wording. Client-safe (no Node APIs, no secrets). */
import { amount, money, symbolOf } from "../format";
import type { OrderSide } from "../schemas";

/** Long: TP above entry, SL below. Short: mirrored. Percentages are 0–100. */
export function tpSlPrices(side: OrderSide, entryPrice: number, tpPct: number, slPct: number): { tpPrice: number; slPrice: number } {
  const tp = entryPrice * (tpPct / 100);
  const sl = entryPrice * (slPct / 100);
  return side === "up"
    ? { tpPrice: entryPrice + tp, slPrice: entryPrice - sl }
    : { tpPrice: entryPrice - tp, slPrice: entryPrice + sl };
}

export function isExpired(signal: { expiresAt: number }, now = Date.now()): boolean {
  return now >= signal.expiresAt;
}

/** "4 hours", "1 hour", "2 days", "90 minutes". */
export function holdLabel(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} minutes`;
  if (hours < 48) return `${Number(hours.toFixed(1))} ${hours === 1 ? "hour" : "hours"}`;
  const days = Number((hours / 24).toFixed(1));
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/** "3h left", "20m left", "expired". */
export function timeLeftLabel(signal: { expiresAt: number }, now = Date.now()): string {
  const ms = signal.expiresAt - now;
  if (ms <= 0) return "expired";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h left`;
  return `${Math.round(hours / 24)}d left`;
}

type Describable = {
  author: string;
  market: string;
  side: OrderSide;
  entryPrice: number;
  tpPrice: number;
  slPrice: number;
  holdHours: number;
  size: number;
};

/**
 * "Ana thinks BTC goes up: in at $80,000, out at $82,400 or $78,400, for 4 hours."
 * The default author name is "You", which takes "think", not "thinks".
 */
export function describe(signal: Describable): string {
  const symbol = symbolOf(signal.market);
  const digits = signal.entryPrice >= 100 ? 0 : 2;
  const verb = signal.author.trim().toLowerCase() === "you" ? "think" : "thinks";
  return `${signal.author} ${verb} ${symbol} goes ${signal.side}: in at $${money(signal.entryPrice, digits)}, out at $${money(signal.tpPrice, digits)} or $${money(signal.slPrice, digits)}, for ${holdLabel(signal.holdHours)}.`;
}

/** "went Up on BTC" */
export function headline(signal: { market: string; side: OrderSide }): string {
  return `went ${signal.side === "up" ? "Up" : "Down"} on ${symbolOf(signal.market)}`;
}

/** Size with its symbol: "0.00002 BTC". */
export function sizeLabel(signal: { market: string; size: number }): string {
  return `${amount(signal.size)} ${symbolOf(signal.market)}`;
}

/* ----- The idea strip: stop loss on the left, take profit on the right ----- */

type Levels = { side: OrderSide; entryPrice: number; tpPrice: number; slPrice: number };

export type ProgressState = "toward-tp" | "toward-sl" | "at-entry" | "beyond-tp" | "beyond-sl" | "unknown";

export type IdeaProgress = {
  /** Positions on the strip, 0 = stop loss, 1 = take profit. */
  stopPos: 0;
  entryPos: number;
  tpPos: 1;
  /** Where the live price sits, clamped to the strip; null without a price. */
  nowPos: number | null;
  state: ProgressState;
};

/** Within this fraction of the entry the price counts as "right at the entry". */
const AT_ENTRY_BAND = 0.002;

/**
 * Progress from the stop loss (0) to the take profit (1). Up: rises with the
 * price; Down: rises as the price falls. Not clamped, so callers can tell
 * "past" from "at".
 */
function progressOf(levels: Levels, price: number): number {
  return levels.side === "up"
    ? (price - levels.slPrice) / (levels.tpPrice - levels.slPrice)
    : (levels.slPrice - price) / (levels.slPrice - levels.tpPrice);
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Geometry for the strip. The entry lands at slPct / (tpPct + slPct) by construction. */
export function ideaProgress(levels: Levels, now: number | null): IdeaProgress {
  const entryPos = clamp01(progressOf(levels, levels.entryPrice));
  if (now === null || !Number.isFinite(now) || now <= 0) {
    return { stopPos: 0, entryPos, tpPos: 1, nowPos: null, state: "unknown" };
  }
  const raw = progressOf(levels, now);
  let state: ProgressState;
  if (Math.abs(now - levels.entryPrice) <= AT_ENTRY_BAND * levels.entryPrice) state = "at-entry";
  else if (raw > 1) state = "beyond-tp";
  else if (raw < 0) state = "beyond-sl";
  else if (raw > entryPos) state = "toward-tp";
  else state = "toward-sl";
  return { stopPos: 0, entryPos, tpPos: 1, nowPos: clamp01(raw), state };
}

/** The one line under the strip: "now $80,600 · on its way to the take profit". */
export function progressSentence(levels: Levels & { expired?: boolean }, now: number | null): string {
  if (levels.expired) return "this idea has ended";
  const { state } = ideaProgress(levels, now);
  if (state === "unknown" || now === null) return "live price unavailable";
  const digits = levels.entryPrice >= 100 ? 0 : 2;
  const nowLabel = `now $${money(now, digits)}`;
  switch (state) {
    case "toward-tp":
      return `${nowLabel} · on its way to the take profit`;
    case "toward-sl":
      return `${nowLabel} · slipping toward the stop loss`;
    case "at-entry":
      return `${nowLabel} · right at the entry`;
    case "beyond-tp":
      return `${nowLabel} · past the take profit`;
    case "beyond-sl":
      return `${nowLabel} · past the stop loss`;
  }
}

/**
 * Pushes label positions apart so none are closer than `minGap`, keeping
 * their order and staying inside [min, max]. Used for the level labels in
 * the mini chart's gutter, where a tight stop loss can sit on the entry.
 */
export function spreadLabels(positions: number[], minGap: number, min: number, max: number): number[] {
  const order = positions.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const spread = order.map((p) => p.y);
  for (let k = 1; k < spread.length; k++) {
    spread[k] = Math.max(spread[k] as number, (spread[k - 1] as number) + minGap);
  }
  // If the last one overflowed, walk back down from the bottom edge.
  const overflow = (spread[spread.length - 1] ?? min) - max;
  if (overflow > 0) {
    for (let k = spread.length - 1; k >= 0; k--) {
      const limit = k === spread.length - 1 ? max : (spread[k + 1] as number) - minGap;
      spread[k] = Math.min(spread[k] as number, limit);
    }
  }
  const result = new Array<number>(positions.length);
  order.forEach((p, k) => {
    result[p.i] = Math.max(min, spread[k] as number);
  });
  return result;
}

/** Copies closer than this share one chart marker; nearer than that their labels overlap. */
export const MARKER_CLUSTER_MS = 10 * 60_000;

/**
 * One chart marker per cluster of copies close in time: "Ben copied",
 * "Ben, Cid copied", "3 copied". A cluster starts at its first copy's minute
 * and takes every copy within `windowMs` of it.
 */
export function groupCopyMarkers(
  copies: { copier: string; createdAt: number }[],
  windowMs = MARKER_CLUSTER_MS,
): { time: number; label: string }[] {
  const sorted = [...copies].sort((a, b) => a.createdAt - b.createdAt);
  const clusters: { time: number; names: string[] }[] = [];
  for (const copy of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && copy.createdAt - last.time < windowMs) last.names.push(copy.copier);
    else clusters.push({ time: Math.floor(copy.createdAt / 60_000) * 60_000, names: [copy.copier] });
  }
  return clusters.map(({ time, names }) => ({
    time,
    label: names.length > 2 ? `${names.length} copied` : `${names.join(", ")} copied`,
  }));
}
