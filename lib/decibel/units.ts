/**
 * Chain-unit math. Pure functions, no SDK or network (unit-tested).
 *
 * Decibel stores prices and sizes as integers: human × 10^decimals. Prices
 * must be multiples of the market tick size, sizes multiples of the lot size
 * and at least the minimum size (all three expressed in chain units by the
 * /markets endpoint). Every order the app signs passes through
 * `toValidOrderSize` first (constitution S4).
 */
import { TradeError } from "./errors";

/** The subset of a /markets row that unit math needs. */
export type MarketPrecision = {
  market_name: string;
  px_decimals: number;
  sz_decimals: number;
  /** Chain units. */
  tick_size: number;
  /** Chain units. */
  lot_size: number;
  /** Chain units. */
  min_size: number;
};

type RoundingMode = "round" | "floor" | "ceil";

/** Absorbs binary floating-point noise such as 0.0015 * 1000 = 1.4999999999999998. */
const EPSILON = 1e-9;

/** Human amount → integer chain units. Default rounding is to nearest. */
export function toChainUnits(value: number, decimals: number, mode: RoundingMode = "round"): number {
  assertFinite(value, "value");
  const scaled = value * 10 ** decimals;
  switch (mode) {
    case "floor":
      return Math.floor(scaled + EPSILON);
    case "ceil":
      return Math.ceil(scaled - EPSILON);
    default:
      return Math.round(scaled);
  }
}

/** Integer chain units → human amount. */
export function fromChainUnits(units: number, decimals: number): number {
  assertFinite(units, "units");
  return units / 10 ** decimals;
}

/** Rounds a chain-unit price to the market tick (nearest by default). */
export function roundToTick(priceUnits: number, tickSize: number, mode: RoundingMode = "round"): number {
  assertFinite(priceUnits, "price");
  if (tickSize <= 0) return Math.round(priceUnits);
  const ticks = priceUnits / tickSize;
  const rounded =
    mode === "floor" ? Math.floor(ticks + EPSILON) : mode === "ceil" ? Math.ceil(ticks - EPSILON) : Math.round(ticks);
  return rounded * tickSize;
}

/** Floors a chain-unit size to the market lot. */
export function floorToLot(sizeUnits: number, lotSize: number): number {
  assertFinite(sizeUnits, "size");
  if (lotSize <= 0) return Math.floor(sizeUnits);
  return Math.floor(sizeUnits / lotSize + EPSILON) * lotSize;
}

/** "BTC" from "BTC/USD"; falls back to the full name. */
export function baseSymbol(marketName: string): string {
  return marketName.split("/")[0] || marketName;
}

/**
 * Validates a human-readable order size and converts it to chain units.
 * Rejects non-finite, non-positive, above-cap, and below-minimum (after lot
 * flooring) sizes with a message that states the allowed range.
 */
export function toValidOrderSize(sizeHuman: number, market: MarketPrecision, maxOrderSize: number): number {
  const symbol = baseSymbol(market.market_name);
  const minHuman = fromChainUnits(market.min_size, market.sz_decimals);
  const range = `between ${formatAmount(minHuman)} and ${formatAmount(maxOrderSize)} ${symbol}`;

  if (typeof sizeHuman !== "number" || !Number.isFinite(sizeHuman)) {
    throw new TradeError("INVALID_SIZE", `Size must be a number ${range}.`);
  }
  if (sizeHuman <= 0) {
    throw new TradeError("INVALID_SIZE", `Size must be more than zero: choose an amount ${range}.`);
  }
  if (sizeHuman > maxOrderSize) {
    throw new TradeError(
      "INVALID_SIZE",
      `That's more than this app allows in one order. Choose an amount ${range}.`,
    );
  }

  const units = floorToLot(toChainUnits(sizeHuman, market.sz_decimals, "floor"), market.lot_size);
  if (units < market.min_size || units <= 0) {
    throw new TradeError("INVALID_SIZE", `That's below the minimum for ${symbol}. Choose an amount ${range}.`);
  }
  return units;
}

/**
 * Limit price for an immediate-or-cancel "market" order: `slippage` through
 * the mid in the order's direction so it crosses the book. Buys round up to
 * the tick, sells round down. Returns chain units.
 */
export function toAggressiveLimitPrice(
  midHuman: number,
  isBuy: boolean,
  market: MarketPrecision,
  slippage = 0.005,
): number {
  assertFinite(midHuman, "mid price");
  if (midHuman <= 0) throw new TradeError("NO_PRICE", "No live price is available for this market right now.");
  const aggressive = isBuy ? midHuman * (1 + slippage) : midHuman * (1 - slippage);
  const units = toChainUnits(aggressive, market.px_decimals, isBuy ? "ceil" : "floor");
  return roundToTick(units, market.tick_size, isBuy ? "ceil" : "floor");
}

/** Human price → chain units rounded to the tick (nearest). Used for TP/SL trigger prices. */
export function toTickPrice(priceHuman: number, market: MarketPrecision): number {
  assertFinite(priceHuman, "price");
  return roundToTick(toChainUnits(priceHuman, market.px_decimals), market.tick_size);
}

export function formatAmount(value: number): string {
  // Up to 8 decimals, trailing zeros trimmed: 0.001 → "0.001", 1 → "1".
  return Number(value.toFixed(8)).toString();
}

function assertFinite(value: number, label: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TradeError("INVALID_SIZE", `Invalid ${label}: expected a finite number.`);
  }
}
