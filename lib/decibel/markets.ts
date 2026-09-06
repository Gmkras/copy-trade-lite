/**
 * Market list and live price in human units, for the HTTP contract.
 * Not guarded (scripts may use it); app code imports via `@/lib/decibel`.
 */
import type { Market, Price } from "../schemas";
import { getDecibel } from "./client";
import { TradeError } from "./errors";
import { baseSymbol, fromChainUnits, type MarketPrecision } from "./units";

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
