import { describe, expect, it, vi, type Mock } from "vitest";

import { TradeError } from "./errors";
import { assertFeeBound, assertTpSlSides, placeMarketOrder, type OrderDeps } from "./orders";
import type { MarketPrecision } from "./units";

// Unit tests never touch the network. The SDK ships ESM with extensionless
// relative imports that Vite's resolver rejects, and orders.ts only needs the
// TimeInForce constant from it, so the module is replaced here.
vi.mock("@decibeltrade/sdk", () => ({
  TimeInForce: { GoodTillCanceled: 0, PostOnly: 1, ImmediateOrCancel: 2 },
  TESTNET_CONFIG: {},
  DecibelReadDex: class {},
  DecibelWriteDex: class {},
}));

// Real BTC/USD testnet precision (from `pnpm smoke`): min 0.00002, tick $1, lot 0.00001.
const BTC: MarketPrecision = {
  market_name: "BTC/USD",
  px_decimals: 6,
  sz_decimals: 9,
  tick_size: 1_000_000,
  lot_size: 10_000,
  min_size: 20_000,
};

type PlaceOrderMock = Mock<OrderDeps["placeOrder"]>;

function fakeDeps(overrides: Partial<OrderDeps> = {}): OrderDeps & { placeOrder: PlaceOrderMock } {
  const placeOrder: PlaceOrderMock =
    (overrides.placeOrder as PlaceOrderMock | undefined) ??
    vi.fn(async () => ({ success: true as const, orderId: "42", transactionHash: "0xabc" }));
  return {
    feeBps: 10,
    maxOrderSize: 0.01,
    builderAddr: "0x" + "1".padStart(64, "0"),
    subaccountAddr: "0x" + "2".padStart(64, "0"),
    getMarkets: async () => [BTC],
    getMidPrice: async () => 80_000,
    getApprovedFeeBps: () => 10,
    ...overrides,
    placeOrder,
  };
}

async function expectTradeError(promise: Promise<unknown>, code: string, fragment: string) {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(TradeError);
  expect((caught as TradeError).code).toBe(code);
  expect((caught as TradeError).message).toContain(fragment);
}

describe("assertTpSlSides", () => {
  it("accepts correct sides", () => {
    expect(() => assertTpSlSides(true, 100, 103, 98)).not.toThrow();
    expect(() => assertTpSlSides(false, 100, 97, 102)).not.toThrow();
    expect(() => assertTpSlSides(true, 100)).not.toThrow();
  });

  it("rejects a long with the stop loss above entry", () => {
    expect(() => assertTpSlSides(true, 100, 103, 101)).toThrow(/stop loss must be below/);
  });

  it("rejects a long with the take profit below entry", () => {
    expect(() => assertTpSlSides(true, 100, 99, 98)).toThrow(/take profit must be above/);
  });

  it("rejects a short with mirrored mistakes", () => {
    expect(() => assertTpSlSides(false, 100, 97, 99)).toThrow(/stop loss must be above/);
    expect(() => assertTpSlSides(false, 100, 101, 102)).toThrow(/take profit must be below/);
  });
});

describe("assertFeeBound", () => {
  it("accepts a fee within the approved max and the cap", () => {
    expect(() => assertFeeBound(10, 10)).not.toThrow();
    expect(() => assertFeeBound(5, 10)).not.toThrow();
  });

  it("rejects when nothing has been approved", () => {
    expect(() => assertFeeBound(10, null)).toThrow(/pnpm approve/);
  });

  it("rejects a fee above the approved max", () => {
    expect(() => assertFeeBound(10, 5)).toThrow(/exceeds the approved maximum of 5/);
  });

  it("rejects a fee above the protocol cap even if 'approved'", () => {
    expect(() => assertFeeBound(11, 11)).toThrow(/protocol cap/);
  });
});

describe("placeMarketOrder", () => {
  it("places an IOC buy 0.5% through the mid with the builder code and returns the hash", async () => {
    const deps = fakeDeps();
    const result = await placeMarketOrder({ marketName: "BTC/USD", isBuy: true, size: 0.00002 }, deps);

    expect(result.transactionHash).toBe("0xabc");
    expect(result.orderId).toBe("42");
    expect(result.referencePrice).toBe(80_000);
    expect(result.size).toBe(0.00002);
    expect(deps.placeOrder).toHaveBeenCalledTimes(1);
    const args = deps.placeOrder.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.price).toBe(80_400_000_000); // 80000 * 1.005 = 80400 → chain units
    expect(args.size).toBe(20_000);
    expect(args.builderFee).toBe(10);
    expect(args.builderAddr).toBe(deps.builderAddr);
    expect(args.tickSize).toBe(BTC.tick_size);
  });

  it("rejects an invalid size before pricing or signing", async () => {
    const deps = fakeDeps();
    await expectTradeError(
      placeMarketOrder({ marketName: "BTC/USD", isBuy: true, size: 0.5 }, deps),
      "INVALID_SIZE",
      "between 0.00002 and 0.01 BTC",
    );
    expect(deps.placeOrder).not.toHaveBeenCalled();
  });

  it("rejects a stop loss on the wrong side before signing", async () => {
    const deps = fakeDeps();
    await expectTradeError(
      placeMarketOrder({ marketName: "BTC/USD", isBuy: true, size: 0.00002, slPrice: 81_000 }, deps),
      "TPSL_SIDE",
      "stop loss must be below",
    );
    expect(deps.placeOrder).not.toHaveBeenCalled();
  });

  it("rejects when the fee exceeds the approved max, before signing", async () => {
    const deps = fakeDeps({ getApprovedFeeBps: () => 5 });
    await expectTradeError(
      placeMarketOrder({ marketName: "BTC/USD", isBuy: true, size: 0.00002 }, deps),
      "FEE_BOUND",
      "exceeds the approved maximum",
    );
    expect(deps.placeOrder).not.toHaveBeenCalled();
  });

  it("rejects an unknown market", async () => {
    const deps = fakeDeps();
    await expectTradeError(
      placeMarketOrder({ marketName: "DOGE/USD", isBuy: true, size: 0.00002 }, deps),
      "UNKNOWN_MARKET",
      "DOGE/USD",
    );
  });

  it("turns an SDK success:false into a readable TradeError (never a silent success)", async () => {
    const deps = fakeDeps({
      placeOrder: vi.fn(async () => ({ success: false as const, error: "INSUFFICIENT_BALANCE: not enough margin" })),
    });
    await expectTradeError(
      placeMarketOrder({ marketName: "BTC/USD", isBuy: true, size: 0.00002 }, deps),
      "INSUFFICIENT_BALANCE",
      "pnpm mint",
    );
  });

  it("humanizes a thrown SDK error", async () => {
    const deps = fakeDeps({
      placeOrder: vi.fn(async () => {
        throw new Error("HTTP 401 anonymous requests are not allowed");
      }),
    });
    await expectTradeError(
      placeMarketOrder({ marketName: "BTC/USD", isBuy: true, size: 0.00002 }, deps),
      "API_KEY_REJECTED",
      "geomi.dev",
    );
  });
});
