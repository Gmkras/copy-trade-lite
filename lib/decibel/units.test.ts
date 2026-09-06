import { describe, expect, it } from "vitest";

import { TradeError } from "./errors";
import {
  floorToLot,
  fromChainUnits,
  roundToTick,
  toAggressiveLimitPrice,
  toChainUnits,
  toTickPrice,
  toValidOrderSize,
  type MarketPrecision,
} from "./units";

// BTC/USD-like market: 6 price decimals, 3 size decimals, tick 0.1, lot 0.001, min 0.001.
const BTC: MarketPrecision = {
  market_name: "BTC/USD",
  px_decimals: 6,
  sz_decimals: 3,
  tick_size: 100_000,
  lot_size: 1,
  min_size: 1,
};
const MAX_ORDER_SIZE = 0.01;

describe("toChainUnits / fromChainUnits", () => {
  it("converts exactly in both directions", () => {
    expect(toChainUnits(64123.5, 6)).toBe(64_123_500_000);
    expect(fromChainUnits(64_123_500_000, 6)).toBe(64123.5);
    expect(toChainUnits(0.001, 3)).toBe(1);
  });

  it("floors without floating-point noise", () => {
    // 0.0015 * 1000 = 1.4999999999999998 in binary floating point
    expect(toChainUnits(0.0015, 3, "floor")).toBe(1);
    expect(toChainUnits(0.003, 3, "floor")).toBe(3);
  });

  it("rejects non-finite input", () => {
    expect(() => toChainUnits(Number.NaN, 6)).toThrow(TradeError);
    expect(() => toChainUnits(Number.POSITIVE_INFINITY, 6)).toThrow(TradeError);
  });
});

describe("roundToTick / floorToLot", () => {
  it("rounds 64123.456 to 64123.5 at tick 0.1", () => {
    const units = toChainUnits(64123.456, BTC.px_decimals);
    expect(roundToTick(units, BTC.tick_size)).toBe(64_123_500_000);
  });

  it("supports floor and ceil to the tick", () => {
    const units = toChainUnits(64123.456, BTC.px_decimals);
    expect(roundToTick(units, BTC.tick_size, "floor")).toBe(64_123_400_000);
    expect(roundToTick(units, BTC.tick_size, "ceil")).toBe(64_123_500_000);
  });

  it("floors 0.0015 to one lot (0.001)", () => {
    expect(floorToLot(toChainUnits(0.0015, BTC.sz_decimals, "floor"), BTC.lot_size)).toBe(1);
  });

  it("floors to a lot larger than one unit", () => {
    expect(floorToLot(17, 5)).toBe(15);
  });
});

describe("toValidOrderSize", () => {
  it("accepts a valid size and floors it to the lot", () => {
    expect(toValidOrderSize(0.0015, BTC, MAX_ORDER_SIZE)).toBe(1);
    expect(toValidOrderSize(0.01, BTC, MAX_ORDER_SIZE)).toBe(10);
  });

  it.each([
    [0, "more than zero"],
    [-1, "more than zero"],
    [Number.NaN, "must be a number"],
    [0.0004, "below the minimum"],
    [0.02, "more than this app allows"],
  ])("rejects %s before any network call", (size, fragment) => {
    let caught: unknown;
    try {
      toValidOrderSize(size, BTC, MAX_ORDER_SIZE);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(TradeError);
    const err = caught as TradeError;
    expect(err.code).toBe("INVALID_SIZE");
    expect(err.message).toContain(fragment);
    // Every rejection names the allowed range in human units.
    expect(err.message).toContain("between 0.001 and 0.01 BTC");
  });
});

describe("toAggressiveLimitPrice", () => {
  it("buys 0.5% above the mid, rounded up to the tick", () => {
    const price = toAggressiveLimitPrice(64000, true, BTC);
    expect(price).toBe(64_320_000_000); // 64000 * 1.005 = 64320.0
    expect(price % BTC.tick_size).toBe(0);
  });

  it("sells 0.5% below the mid, rounded down to the tick", () => {
    const price = toAggressiveLimitPrice(64000, false, BTC);
    expect(price).toBe(63_680_000_000); // 64000 * 0.995 = 63680.0
    expect(price % BTC.tick_size).toBe(0);
  });

  it("rounds in the aggressive direction when the result is off-tick", () => {
    // 64123.456 * 1.005 = 64444.07328 → ceil to tick 0.1 → 64444.1
    expect(toAggressiveLimitPrice(64123.456, true, BTC)).toBe(64_444_100_000);
    // 64123.456 * 0.995 = 63802.83872 → floor to tick 0.1 → 63802.8
    expect(toAggressiveLimitPrice(64123.456, false, BTC)).toBe(63_802_800_000);
  });

  it("rejects a missing or zero mid", () => {
    expect(() => toAggressiveLimitPrice(0, true, BTC)).toThrow(TradeError);
    expect(() => toAggressiveLimitPrice(Number.NaN, true, BTC)).toThrow(TradeError);
  });
});

describe("toTickPrice", () => {
  it("rounds a TP/SL price to the nearest tick", () => {
    expect(toTickPrice(66000.04, BTC)).toBe(66_000_000_000);
    expect(toTickPrice(66000.06, BTC)).toBe(66_000_100_000);
  });
});
