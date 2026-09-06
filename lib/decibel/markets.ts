/**
 * Market list and live price in human units, for the HTTP contract.
 * Not guarded (scripts may use it); app code imports via `@/lib/decibel`.
 */
import type { Candle, Market, Price } from "../schemas";
import { getDecibel } from "./client";
import { TradeError } from "./errors";
import { baseSymbol, fromChainUnits, toValidOrderSize, type MarketPrecision } from "./units";

export type MarketRow = MarketPrecision & { market_addr: string; mode: string };

/**
 * Open perp markets this app can actually trade, in human units, BTC/USD first.
 * MAX_ORDER_SIZE is a single cap in base units, so markets whose minimum order
 * is above it (e.g. ADA min 5) are left out rather than shown with an
 * impossible range.
 */
export async function listMarkets(): Promise<Market[]> {
  const d = getDecibel();
  const rows = await d.read.markets.getAll();
  return rows
    .filter((m) => m.mode === "Open")
    .map((m) => toMarket(m, d.maxOrderSize))
    .filter((m) => m.minSize <= m.maxOrderSize)
    .sort((a, b) => (a.name === "BTC/USD" ? -1 : b.name === "BTC/USD" ? 1 : a.name.localeCompare(b.name)));
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
export async function getCandles(marketName: string, minutes = 200): Promise<Candle[]> {
  const d = getDecibel();
  const endTime = Date.now();
  const startTime = endTime - minutes * 60_000;
  const rows = await d.read.candlesticks.getByName({ marketName, interval: "1m", startTime, endTime });
  return rows
    .map((r) => ({ t: r.t, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v }))
    .sort((a, b) => a.t - b.t);
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
