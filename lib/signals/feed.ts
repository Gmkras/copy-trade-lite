/**
 * The one feed loader, used by the server-rendered home page and by
 * `GET /api/signals`, so the first paint and every later poll agree.
 *
 * Not guarded with `server-only` (tests may import it); app code imports it
 * through `@/lib/signals` (index.ts), which adds the guard.
 */
import { getCandlesFor, getCandlesSince, getPrices } from "../decibel/markets";
import type { Candle, SignalList, SignalView } from "../schemas";
import { isExpired } from "./math";
import { settleAll } from "./outcome";
import { signalsRepo } from "./repo";

/** How much price history each card draws by default: the last hour. */
export const FEED_CANDLE_RANGE = "1h" as const;

export async function loadFeed(): Promise<SignalList> {
  const repo = signalsRepo();
  const now = Date.now();
  const [rows, authorsBefore] = await Promise.all([repo.listSignals(), repo.authorStats()]);

  // Decide how the open ideas ended, from their markets' candles. One read per
  // market; a market that cannot be read leaves its ideas open (never throws).
  const outcomes = await settleAll(rows, now, { getCandlesSince });
  let authors = authorsBefore;
  if (outcomes.length > 0) {
    const settled = new Map(outcomes.map((o) => [o.id, o.outcome]));
    await Promise.all(outcomes.map((o) => repo.setOutcome(o.id, o.outcome)));
    for (const row of rows) {
      const outcome = settled.get(row.id);
      if (outcome) row.outcome = outcome;
    }
    // The records changed, so the summary has to be read again.
    authors = await repo.authorStats();
  }

  const signals: SignalView[] = rows.map((s) => ({ ...s, expired: isExpired(s, now) }));

  // Ideas whose hold has not ended still get a price line and a "now" marker —
  // including one that just settled, which is exactly when seeing the price
  // touch the level is most useful. Ideas past their deadline get neither.
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
