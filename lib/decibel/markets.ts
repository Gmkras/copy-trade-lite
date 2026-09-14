/**
 * Market list and live price in human units, for the HTTP contract.
 * Not guarded (scripts may use it); app code imports via `@/lib/decibel`.
 */
import { intervalForSpan, rangeToInterval, type CandleInterval } from "../charts";
import type { Candle, CandleRange, CandlesResponse, Market, MarketStats, Price, Ticker } from "../schemas";
import { getDecibel } from "./client";
import { TradeError, errorText } from "./errors";
import { baseSymbol, fromChainUnits, toValidOrderSize, type MarketPrecision } from "./units";

export type MarketRow = MarketPrecision & { market_addr: string; mode: string };

/**
 * The rows `GET /api/markets` is built from: open, tradable under the app's
 * size cap, BTC/USD first. Shared by `listMarkets` and `listTickers` so the
 * coin strip can never list a market the trade screen does not offer.
 */
export function tradableRows<T extends MarketRow>(rows: T[], maxOrderSize: number): T[] {
  return rows
    .filter((m) => m.mode === "Open" && fromChainUnits(m.min_size, m.sz_decimals) <= maxOrderSize)
    .sort((a, b) =>
      a.market_name === "BTC/USD" ? -1 : b.market_name === "BTC/USD" ? 1 : a.market_name.localeCompare(b.market_name),
    );
}

/**
 * Open perp markets this app can actually trade, in human units, BTC/USD first.
 * MAX_ORDER_SIZE is a single cap in base units, so markets whose minimum order
 * is above it (e.g. ADA min 5) are left out rather than shown with an
 * impossible range.
 */
export async function listMarkets(): Promise<Market[]> {
  const d = getDecibel();
  const rows = await d.read.markets.getAll();
  return tradableRows(rows, d.maxOrderSize).map((m) => toMarket(m, d.maxOrderSize));
}

/** A quote worth showing: finite and above zero. Anything else is "no price". */
function positiveOrNull(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/** A signed figure: finite is enough, because zero and negatives are real values. */
function finiteOrNull(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Just enough of a `marketPrices` row for the join (keyed by ADDRESS). */
export type PriceRow = { market: string; mid_px: number };
/** Just enough of a `marketContexts` row for the join (keyed by NAME). */
export type ContextRow = { market: string; price_change_pct_24h: number };

/**
 * Joins markets, prices and 24-hour contexts into the coin strip's rows. Pure,
 * so the join is unit-tested without the network.
 *
 * The two sources key their rows differently — contexts by market **name**,
 * prices by market **address** — exactly like the WebSocket does (see
 * `stream.ts`). A price row whose address is not in the market list is dropped
 * rather than shown as a hash, and a market missing from either source keeps
 * its row with `null` in that field.
 */
export function joinTickers(
  rows: MarketRow[],
  prices: PriceRow[],
  contexts: ContextRow[],
  maxOrderSize: number,
): Ticker[] {
  const midByAddr = new Map(prices.map((p) => [p.market, p.mid_px]));
  const changeByName = new Map(contexts.map((c) => [c.market, c.price_change_pct_24h]));
  return tradableRows(rows, maxOrderSize).map((m) => ({
    market: m.market_name,
    symbol: baseSymbol(m.market_name),
    mid: positiveOrNull(midByAddr.get(m.market_addr)),
    changePct24h: finiteOrNull(changeByName.get(m.market_name)),
  }));
}

/**
 * One row per tradable market with its live mid and 24-hour change, for the
 * coin strip. Three upstream calls whatever the market count (design D1);
 * prices and contexts are best-effort, the market list is not.
 */
export async function listTickers(): Promise<Ticker[]> {
  const d = getDecibel();
  const rows = await d.read.markets.getAll();
  const [pricesResult, contextsResult] = await Promise.allSettled([
    d.read.marketPrices.getAll(),
    d.read.marketContexts.getAll(),
  ]);
  if (pricesResult.status === "rejected") {
    console.warn("[tickers] no live prices:", errorText(pricesResult.reason));
  }
  if (contextsResult.status === "rejected") {
    console.warn("[tickers] no 24h contexts:", errorText(contextsResult.reason));
  }
  return joinTickers(
    rows,
    pricesResult.status === "fulfilled" ? pricesResult.value : [],
    contextsResult.status === "fulfilled" ? contextsResult.value : [],
    d.maxOrderSize,
  );
}

export function toMarket(m: MarketPrecision, maxOrderSize: number): Market {
  return {
    name: m.market_name,
    symbol: baseSymbol(m.market_name),
    minSize: fromChainUnits(m.min_size, m.sz_decimals),
    sizeStep: fromChainUnits(m.lot_size, m.sz_decimals),
    priceStep: fromChainUnits(m.tick_size, m.px_decimals),
    maxOrderSize,
  };
}

/**
 * Validates a human size against the market's bounds and the app cap exactly
 * like an order would, and returns the size that would actually be sent
 * (floored to the lot). Throws the same TradeError messages as the trade screen.
 */
export async function assertTradableSize(marketName: string, size: number): Promise<number> {
  const d = getDecibel();
  const markets = await d.read.markets.getAll();
  const market = markets.find((m) => m.market_name === marketName);
  if (!market) throw new TradeError("UNKNOWN_MARKET", `Unknown market "${marketName}".`);
  const units = toValidOrderSize(size, market, d.maxOrderSize);
  return fromChainUnits(units, market.sz_decimals);
}

/** Last `minutes` one-minute candles for a market, ascending, ms timestamps. */
export type CandleWindow = { interval: CandleInterval; count: number };

/** The last `count` candles of `interval` for a market, ascending. */
export async function getCandles(marketName: string, window: CandleWindow): Promise<Candle[]> {
  const d = getDecibel();
  const endTime = Date.now();
  const startTime = endTime - window.count * intervalMs(window.interval);
  const rows = await d.read.candlesticks.getByName({ marketName, interval: window.interval, startTime, endTime });
  return rows
    .map((r) => ({ t: r.t, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v }))
    .sort((a, b) => a.t - b.t);
}

/**
 * Every candle from `sinceMs` until now, at the interval that fits the span
 * (`intervalForSpan`). Used to settle ideas: the window is however long the
 * idea has been open, which is not a fixed count of candles.
 */
export async function getCandlesSince(marketName: string, sinceMs: number): Promise<Candle[]> {
  const d = getDecibel();
  const endTime = Date.now();
  const startTime = Math.min(sinceMs, endTime);
  const interval = intervalForSpan(endTime - startTime);
  const rows = await d.read.candlesticks.getByName({ marketName, interval, startTime, endTime });
  return rows.map((r) => ({ t: r.t, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v })).sort((a, b) => a.t - b.t);
}

function intervalMs(interval: CandleInterval): number {
  switch (interval) {
    case "1m":
      return 60_000;
    case "5m":
      return 300_000;
    case "15m":
      return 900_000;
    case "1h":
      return 3_600_000;
  }
}

/**
 * Candles for one market over a named range, for `GET /api/candles`. Unknown
 * markets are refused before the exchange is asked, like `getPrice`.
 */
export async function getCandlesByRange(marketName: string, range: CandleRange): Promise<CandlesResponse> {
  const d = getDecibel();
  const markets = await d.read.markets.getAll();
  if (!markets.some((m) => m.market_name === marketName)) {
    throw new TradeError("UNKNOWN_MARKET", `Unknown market "${marketName}".`);
  }
  const spec = rangeToInterval(range);
  const candles = await getCandles(marketName, spec);
  return { market: marketName, range, interval: spec.interval, candles };
}

/**
 * Live mids for several markets at once, for the feed. Markets that are
 * unknown or fail to quote are left out (and logged), never fatal: a card
 * without a price still draws its levels.
 */
export async function getPrices(marketNames: string[]): Promise<Record<string, number>> {
  if (marketNames.length === 0) return {};
  const d = getDecibel();
  const known = new Set((await d.read.markets.getAll()).map((m) => m.market_name));
  const wanted = marketNames.filter((name) => known.has(name));
  const settled = await Promise.allSettled(
    wanted.map(async (marketName) => {
      const [row] = await d.read.marketPrices.getByName({ marketName });
      return { marketName, mid: row?.mid_px };
    }),
  );
  const prices: Record<string, number> = {};
  settled.forEach((result, i) => {
    if (result.status === "fulfilled" && Number.isFinite(result.value.mid) && (result.value.mid ?? 0) > 0) {
      prices[result.value.marketName] = result.value.mid as number;
    } else {
      console.warn(`[feed] no live price for ${wanted[i]}:`, result.status === "rejected" ? result.reason : "empty quote");
    }
  });
  return prices;
}

/**
 * Recent one-minute candles for several markets, for the feed's mini charts.
 * A market that fails is left out (and logged): its card falls back to the
 * strip drawn from the idea alone.
 */
export async function getCandlesFor(marketNames: string[], range: CandleRange): Promise<Record<string, Candle[]>> {
  const spec = rangeToInterval(range);
  const settled = await Promise.allSettled(marketNames.map((name) => getCandles(name, spec)));
  const candles: Record<string, Candle[]> = {};
  settled.forEach((result, i) => {
    const name = marketNames[i] as string;
    if (result.status === "fulfilled" && result.value.length > 0) candles[name] = result.value;
    else console.warn(`[feed] no candles for ${name}:`, result.status === "rejected" ? result.reason : "empty");
  });
  return candles;
}

/**
 * Highest high and lowest low of the candles given, or nulls when there are
 * none usable. Pure, so the derivation behind `high24h` / `low24h` is tested.
 */
export function highLow(candles: Candle[]): { high: number | null; low: number | null } {
  let high: number | null = null;
  let low: number | null = null;
  for (const candle of candles) {
    if (Number.isFinite(candle.h) && (high === null || candle.h > high)) high = candle.h;
    if (Number.isFinite(candle.l) && (low === null || candle.l < low)) low = candle.l;
  }
  return { high, low };
}

/** 24 hours of quarter-hour candles: where `high24h` and `low24h` come from (design D2). */
const DAY_WINDOW = { interval: "15m", count: 96 } as const;

/**
 * The day's figures for one market, for the statistics row beside the price.
 * The market is checked against the live list before the exchange is asked for
 * anything else. Each source is best-effort: a figure that cannot be read is
 * `null`, never 0, so the interface can honestly show "—" (design D2).
 */
export async function getMarketStats(marketName: string): Promise<MarketStats> {
  const d = getDecibel();
  const markets = await d.read.markets.getAll();
  if (!markets.some((m) => m.market_name === marketName)) {
    throw new TradeError("UNKNOWN_MARKET", `Unknown market "${marketName}".`);
  }

  const [contextsResult, priceResult, candlesResult] = await Promise.allSettled([
    d.read.marketContexts.getAll(),
    d.read.marketPrices.getByName({ marketName }),
    getCandles(marketName, DAY_WINDOW),
  ]);
  if (contextsResult.status === "rejected") {
    console.warn(`[stats] no 24h context for ${marketName}:`, errorText(contextsResult.reason));
  }
  if (priceResult.status === "rejected") {
    console.warn(`[stats] no funding for ${marketName}:`, errorText(priceResult.reason));
  }
  if (candlesResult.status === "rejected") {
    console.warn(`[stats] no day candles for ${marketName}:`, errorText(candlesResult.reason));
  }

  // Contexts are keyed by name here (unlike marketPrices.getAll — see joinTickers).
  const context = contextsResult.status === "fulfilled"
    ? contextsResult.value.find((c) => c.market === marketName)
    : undefined;
  const price = priceResult.status === "fulfilled" ? priceResult.value[0] : undefined;
  const { high, low } = highLow(candlesResult.status === "fulfilled" ? candlesResult.value : []);

  return {
    market: marketName,
    changePct24h: finiteOrNull(context?.price_change_pct_24h),
    high24h: high,
    low24h: low,
    volume24h: finiteOrNull(context?.volume_24h),
    // Both sources carry open interest; the context's is the 24-hour view.
    openInterest: finiteOrNull(context?.open_interest ?? price?.open_interest),
    fundingRateBps: finiteOrNull(price?.funding_rate_bps),
    isFundingPositive: typeof price?.is_funding_positive === "boolean" ? price.is_funding_positive : null,
    fundingPeriodS: finiteOrNull(price?.funding_period_s),
  };
}

/** Live mid/mark for one market by name. */
export async function getPrice(marketName: string): Promise<Price> {
  const d = getDecibel();
  const markets = await d.read.markets.getAll();
  if (!markets.some((m) => m.market_name === marketName)) {
    throw new TradeError("UNKNOWN_MARKET", `Unknown market "${marketName}".`);
  }
  const [row] = await d.read.marketPrices.getByName({ marketName });
  if (!row || !Number.isFinite(row.mid_px) || row.mid_px <= 0) {
    throw new TradeError("NO_PRICE", `No live price for ${baseSymbol(marketName)} right now. Try again in a moment.`);
  }
  return { market: marketName, mid: row.mid_px, mark: row.mark_px, updatedAt: row.transaction_unix_ms };
}
