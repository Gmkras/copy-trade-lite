/**
 * The one feed loader, used by the server-rendered home page and by
 * `GET /api/signals`, so the first paint and every later poll agree.
 *
 * Not guarded with `server-only` (tests may import it); app code imports it
 * through `@/lib/signals` (index.ts), which adds the guard.
 */
import { getCandlesFor, getPrices } from "../decibel/markets";
import type { Candle, SignalList, SignalView } from "../schemas";
import { isExpired } from "./math";
import { signalsRepo } from "./repo";

/** How much price history each card draws by default: the last hour. */
export const FEED_CANDLE_RANGE = "1h" as const;

export async function loadFeed(): Promise<SignalList> {
  const repo = signalsRepo();
  const now = Date.now();
  const [rows, authors] = await Promise.all([repo.listSignals(), repo.authorStats()]);
  const signals: SignalView[] = rows.map((s) => ({ ...s, expired: isExpired(s, now) }));

  // Only live ideas need a "now" marker and a price line; expired ones say they have ended.
  const markets = [...new Set(signals.filter((s) => !s.expired).map((s) => s.market))];
  let prices: Record<string, number> = {};
  let candles: Record<string, Candle[]> = {};
  try {
    [prices, candles] = await Promise.all([getPrices(markets), getCandlesFor(markets, FEED_CANDLE_RANGE)]);
  } catch (error) {
    // The ideas are still worth showing without a live price on them.
    console.warn("[feed] live prices unavailable:", error);
  }

  return { signals, authors, prices, candles, updatedAt: now };
}
