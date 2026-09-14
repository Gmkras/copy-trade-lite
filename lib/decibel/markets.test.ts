import { describe, expect, it, vi } from "vitest";

// The SDK ships ESM with extensionless relative imports that Vite cannot
// resolve, and these tests only exercise the pure join and filter — the client
// it pulls in transitively is never built here.
vi.mock("@decibeltrade/sdk", () => ({
  TESTNET_CONFIG: {},
  DecibelReadDex: class {},
  DecibelWriteDex: class {},
  TimeInForce: {},
}));

import { highLow, joinTickers, tradableRows, type ContextRow, type MarketRow, type PriceRow } from "./markets";
import type { Candle } from "../schemas";

/** A market row with the six fields the join and the filter actually read. */
function market(name: string, addr: string, overrides: Partial<MarketRow> = {}): MarketRow {
  return {
    market_name: name,
    market_addr: addr,
    mode: "Open",
    px_decimals: 2,
    sz_decimals: 5,
    tick_size: 1,
    lot_size: 1,
    min_size: 1, // 0.00001 at sz_decimals 5
    ...overrides,
  };
}

const BTC = market("BTC/USD", "0xbtc");
const ETH = market("ETH/USD", "0xeth");
const AAVE = market("AAVE/USD", "0xaave");
const MAX = 0.01;

describe("tradableRows", () => {
  it("drops markets that are not open", () => {
    const rows = tradableRows([BTC, market("OLD/USD", "0xold", { mode: "Paused" })], MAX);
    expect(rows.map((m) => m.market_name)).toEqual(["BTC/USD"]);
  });

  it("drops markets whose minimum order is above the app's cap", () => {
    // min_size 500000 at sz_decimals 5 = 5 units, above the 0.01 cap.
    const big = market("ADA/USD", "0xada", { min_size: 500_000 });
    const rows = tradableRows([BTC, big], MAX);
    expect(rows.map((m) => m.market_name)).toEqual(["BTC/USD"]);
  });

  it("puts BTC/USD first and sorts the rest alphabetically", () => {
    const rows = tradableRows([ETH, AAVE, BTC], MAX);
    expect(rows.map((m) => m.market_name)).toEqual(["BTC/USD", "AAVE/USD", "ETH/USD"]);
  });
});

describe("joinTickers", () => {
  // Prices are keyed by ADDRESS, contexts by NAME — the split observed on testnet.
  const prices: PriceRow[] = [
    { market: "0xbtc", mid_px: 79168 },
    { market: "0xeth", mid_px: 2450.5 },
  ];
  const contexts: ContextRow[] = [
    { market: "BTC/USD", price_change_pct_24h: 2.531 },
    { market: "ETH/USD", price_change_pct_24h: -1.2 },
  ];

  it("joins both sources despite their different keys", () => {
    const [btc] = joinTickers([BTC], prices, contexts, MAX);
    expect(btc).toEqual({ market: "BTC/USD", symbol: "BTC", mid: 79168, changePct24h: 2.531 });
  });

  it("keeps a negative change, which is a real value", () => {
    const [eth] = joinTickers([ETH], prices, contexts, MAX);
    expect(eth?.changePct24h).toBe(-1.2);
  });

  it("returns a null mid when the market has no price row", () => {
    const [aave] = joinTickers([AAVE], prices, contexts, MAX);
    expect(aave).toEqual({ market: "AAVE/USD", symbol: "AAVE", mid: null, changePct24h: null });
  });

  it("returns a null change when the market has no context row", () => {
    const [aave] = joinTickers([AAVE], [{ market: "0xaave", mid_px: 136 }], contexts, MAX);
    expect(aave?.mid).toBe(136);
    expect(aave?.changePct24h).toBeNull();
  });

  it("drops a price row whose address is not a known market", () => {
    const rows = joinTickers([BTC], [...prices, { market: "0xspot", mid_px: 1 }], contexts, MAX);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.market).toBe("BTC/USD");
  });

  it("returns every market with nulls when both sources failed", () => {
    const rows = joinTickers([BTC, ETH], [], [], MAX);
    expect(rows).toHaveLength(2);
    expect(rows.every((t) => t.mid === null && t.changePct24h === null)).toBe(true);
  });

  it("treats a zero or negative mid as no price", () => {
    const [btc] = joinTickers([BTC], [{ market: "0xbtc", mid_px: 0 }], contexts, MAX);
    expect(btc?.mid).toBeNull();
  });
});

describe("highLow", () => {
  const candle = (h: number, l: number): Candle => ({ t: 0, o: l, h, l, c: h, v: 1 });

  it("spans every candle, not just the last", () => {
    expect(highLow([candle(100, 90), candle(120, 95), candle(110, 80)])).toEqual({ high: 120, low: 80 });
  });

  it("returns nulls with no candles, so the interface can show a dash", () => {
    expect(highLow([])).toEqual({ high: null, low: null });
  });

  it("returns high >= low for a single candle", () => {
    expect(highLow([candle(100, 90)])).toEqual({ high: 100, low: 90 });
  });

  it("skips a candle whose values are not finite", () => {
    expect(highLow([candle(100, 90), candle(Number.NaN, Number.NaN)])).toEqual({ high: 100, low: 90 });
  });
});
