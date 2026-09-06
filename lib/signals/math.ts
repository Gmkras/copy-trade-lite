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

/** "Ana thinks BTC goes up: in at $80,000, out at $82,400 or $78,400, for 4 hours." */
export function describe(signal: Describable): string {
  const symbol = symbolOf(signal.market);
  const digits = signal.entryPrice >= 100 ? 0 : 2;
  return `${signal.author} thinks ${symbol} goes ${signal.side}: in at $${money(signal.entryPrice, digits)}, out at $${money(signal.tpPrice, digits)} or $${money(signal.slPrice, digits)}, for ${holdLabel(signal.holdHours)}.`;
}

/** "went Up on BTC" */
export function headline(signal: { market: string; side: OrderSide }): string {
  return `went ${signal.side === "up" ? "Up" : "Down"} on ${symbolOf(signal.market)}`;
}

/** Size with its symbol: "0.00002 BTC". */
export function sizeLabel(signal: { market: string; size: number }): string {
  return `${amount(signal.size)} ${symbolOf(signal.market)}`;
}
