import { describe, expect, it } from "vitest";

import { OrderInput } from "./schemas";

describe("OrderInput", () => {
  it("accepts a valid body", () => {
    const parsed = OrderInput.parse({ market: "BTC/USD", side: "up", size: 0.00002 });
    expect(parsed).toEqual({ market: "BTC/USD", side: "up", size: 0.00002 });
  });

  it("coerces a numeric string size", () => {
    expect(OrderInput.parse({ market: "BTC/USD", side: "down", size: "0.0001" }).size).toBe(0.0001);
  });

  it("passes a non-numeric size through as NaN for the domain to reject with the range", () => {
    // The range message comes from toValidOrderSize, the single source of truth.
    expect(Number.isNaN(OrderInput.parse({ market: "BTC/USD", side: "up", size: "abc" }).size)).toBe(true);
  });

  it("rejects an unknown field such as builderFee", () => {
    const result = OrderInput.safeParse({ market: "BTC/USD", side: "up", size: 0.00002, builderFee: 1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.code).toBe("unrecognized_keys");
    }
  });

  it("rejects price, builderAddr and timeInForce the same way", () => {
    for (const extra of [{ price: 1 }, { builderAddr: "0x1" }, { timeInForce: 2 }]) {
      expect(OrderInput.safeParse({ market: "BTC/USD", side: "up", size: 0.00002, ...extra }).success).toBe(false);
    }
  });

  it("rejects a bad side and a missing market", () => {
    expect(OrderInput.safeParse({ market: "BTC/USD", side: "long", size: 1 }).success).toBe(false);
    expect(OrderInput.safeParse({ market: "", side: "up", size: 1 }).success).toBe(false);
    expect(OrderInput.safeParse({ side: "up", size: 1 }).success).toBe(false);
  });

  it("rejects a missing size and an object size", () => {
    expect(OrderInput.safeParse({ market: "BTC/USD", side: "up" }).success).toBe(false);
    expect(OrderInput.safeParse({ market: "BTC/USD", side: "up", size: { n: 1 } }).success).toBe(false);
  });
});
