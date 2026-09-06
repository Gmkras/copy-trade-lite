import { describe, expect, it, vi } from "vitest";

vi.mock("@decibeltrade/sdk", () => ({
  TimeInForce: { GoodTillCanceled: 0, PostOnly: 1, ImmediateOrCancel: 2 },
  TESTNET_CONFIG: {},
  DecibelReadDex: class {},
  DecibelWriteDex: class {},
}));

import { emptyAccount, fillSide, getAccountState, positionPnl, type AccountReader } from "./account";

const BTC_ADDR = "0x161b";
const ETH_ADDR = "0x2222";

function reader(overrides: Partial<AccountReader> = {}): AccountReader {
  return {
    getMarkets: async () => [
      { market_name: "BTC/USD", market_addr: BTC_ADDR },
      { market_name: "ETH/USD", market_addr: ETH_ADDR },
    ],
    getPrices: async () => [
      { market: BTC_ADDR, mark_px: 81_000, mid_px: 81_000 },
      { market: ETH_ADDR, mark_px: 3_000, mid_px: 3_000 },
    ],
    getOverview: async () => ({
      perp_equity_balance: 1000,
      usdc_cross_withdrawable_balance: 990,
      unrealized_pnl: 5,
      cross_available_to_trade: 995,
    }),
    getPositions: async () => [
      { market: BTC_ADDR, size: 0.001, entry_price: 80_000, estimated_liquidation_price: 40_000 },
      { market: ETH_ADDR, size: -1, entry_price: 3_100, estimated_liquidation_price: 6_000 },
    ],
    getOrders: async () => ({
      items: [{ market: BTC_ADDR, is_buy: false, remaining_size: 0.002, orig_size: 0.002, price: 90_000, unix_ms: 1_700_000_000_000 }],
    }),
    getFills: async () => ({
      items: [{ market: BTC_ADDR, action: "OpenLong", size: 0.001, price: 80_000, fee_amount: 0.02, transaction_unix_ms: 1_700_000_000_000 }],
    }),
    ...overrides,
  };
}

describe("positionPnl", () => {
  it("long gains when mark rises", () => {
    const { pnlUsd, pnlPct } = positionPnl(0.001, 80_000, 81_000);
    expect(pnlUsd).toBeCloseTo(1);
    expect(pnlPct).toBeCloseTo(0.0125);
  });

  it("short gains when mark falls (negative size)", () => {
    const { pnlUsd, pnlPct } = positionPnl(-1, 3_100, 3_000);
    expect(pnlUsd).toBeCloseTo(100);
    expect(pnlPct).toBeCloseTo(100 / 3_100);
  });

  it("short loses when mark rises", () => {
    expect(positionPnl(-1, 3_000, 3_100).pnlUsd).toBeCloseTo(-100);
  });
});

describe("getAccountState", () => {
  it("joins names, prices and computes PnL per position", async () => {
    const state = await getAccountState(reader(), 123);
    expect(state.exists).toBe(true);
    expect(state.equity).toBe(1000);
    expect(state.available).toBe(995);
    expect(state.unrealizedPnl).toBe(5);
    expect(state.updatedAt).toBe(123);

    const [btc, eth] = state.positions;
    expect(btc).toMatchObject({ market: "BTC/USD", symbol: "BTC", side: "up", size: 0.001, markPrice: 81_000 });
    expect(btc?.pnlUsd).toBeCloseTo(1);
    expect(eth).toMatchObject({ market: "ETH/USD", side: "down", size: 1, markPrice: 3_000 });
    expect(eth?.pnlUsd).toBeCloseTo(100);

    expect(state.orders[0]).toMatchObject({ market: "BTC/USD", side: "down", size: 0.002, price: 90_000 });
    expect(state.fills[0]).toMatchObject({ market: "BTC/USD", action: "OpenLong", side: "up", fee: 0.02 });
  });

  it("returns an empty account (not an error) when the subaccount does not exist yet", async () => {
    const notFound = async () => {
      throw new Error("HTTP Error 404 (notFound): Account 0x2cec not found");
    };
    const state = await getAccountState(reader({ getOverview: notFound, getPositions: notFound }), 5);
    expect(state).toEqual(emptyAccount(5));
  });

  it("rethrows other failures", async () => {
    const boom = async () => {
      throw new Error("HTTP Error 401 anonymous requests are not allowed");
    };
    await expect(getAccountState(reader({ getOverview: boom }))).rejects.toThrow(/401/);
  });

  it("falls back to the entry price when no mark price is known and skips flat positions", async () => {
    const state = await getAccountState(
      reader({
        getPrices: async () => [],
        getPositions: async () => [
          { market: BTC_ADDR, size: 0.001, entry_price: 80_000, estimated_liquidation_price: 0 },
          { market: ETH_ADDR, size: 0, entry_price: 3_000, estimated_liquidation_price: 0 },
        ],
      }),
    );
    expect(state.positions).toHaveLength(1);
    expect(state.positions[0]?.pnlUsd).toBe(0);
  });
});

describe("fillSide", () => {
  it("maps actions to up/down", () => {
    expect(fillSide("OpenLong")).toBe("up");
    expect(fillSide("CloseShort")).toBe("up");
    expect(fillSide("OpenShort")).toBe("down");
    expect(fillSide("CloseLong")).toBe("down");
  });
});
