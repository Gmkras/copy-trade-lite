import { describe, expect, it } from "vitest";

import { applyPrice, parsePriceEvent } from "./useLive";

describe("parsePriceEvent", () => {
  it("reads a well-formed price", () => {
    expect(parsePriceEvent('{"type":"price","market":"BTC/USD","mid":80000,"mark":80010}')).toEqual({
      market: "BTC/USD",
      mid: 80_000,
    });
  });

  it("ignores a malformed frame instead of throwing", () => {
    expect(parsePriceEvent("not json")).toBeNull();
    expect(parsePriceEvent("")).toBeNull();
    expect(parsePriceEvent("null")).toBeNull();
    expect(parsePriceEvent("[1,2,3]")).toBeNull();
  });

  it("ignores a price it would not show", () => {
    expect(parsePriceEvent('{"market":"BTC/USD","mid":0}')).toBeNull();
    expect(parsePriceEvent('{"market":"BTC/USD","mid":-5}')).toBeNull();
    expect(parsePriceEvent('{"market":"BTC/USD","mid":"80000"}')).toBeNull();
    expect(parsePriceEvent('{"market":"","mid":80000}')).toBeNull();
    expect(parsePriceEvent('{"mid":80000}')).toBeNull();
  });
});

describe("applyPrice", () => {
  it("keeps the newest price per market", () => {
    const first = applyPrice({}, { market: "BTC/USD", mid: 80_000 });
    const second = applyPrice(first, { market: "BTC/USD", mid: 80_100 });
    const other = applyPrice(second, { market: "ETH/USD", mid: 3_000 });
    expect(other).toEqual({ "BTC/USD": 80_100, "ETH/USD": 3_000 });
  });

  it("returns the same object when nothing changed, so React does not re-render", () => {
    const prices = { "BTC/USD": 80_000 };
    expect(applyPrice(prices, { market: "BTC/USD", mid: 80_000 })).toBe(prices);
    expect(applyPrice(prices, null)).toBe(prices);
  });
});
