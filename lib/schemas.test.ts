import { describe, expect, it } from "vitest";

import { CopyInput, OrderInput, SignalInput } from "./schemas";

const validSignal = { author: "Ana", market: "BTC/USD", side: "up", tpPct: 3, slPct: 2, holdHours: 4, size: 0.00002 };

describe("SignalInput", () => {
  it("accepts a valid idea and coerces numeric strings", () => {
    const parsed = SignalInput.parse({ ...validSignal, tpPct: "3", holdHours: "4", note: "  looks strong  " });
    expect(parsed).toMatchObject({ author: "Ana", tpPct: 3, holdHours: 4, size: 0.00002, note: "looks strong" });
  });

  it.each([
    [{ tpPct: 0 }, "Take profit must be more than 0%"],
    [{ slPct: 150 }, "Stop loss must be less than 100%"],
    [{ holdHours: 0 }, "at least 1 hour"],
    [{ holdHours: 1000 }, "at most 720 hours"],
    [{ author: "   " }, "Add a name"],
    [{ side: "long" }, ""],
  ])("rejects %j", (patch, fragment) => {
    const result = SignalInput.safeParse({ ...validSignal, ...patch });
    expect(result.success).toBe(false);
    if (!result.success && fragment) expect(result.error.issues[0]?.message).toContain(fragment);
  });

  it("rejects an entryPrice or any other unknown field (the server sets the entry)", () => {
    for (const extra of [{ entryPrice: 1 }, { tpPrice: 1 }, { builderFee: 1 }, { expiresAt: 0 }]) {
      expect(SignalInput.safeParse({ ...validSignal, ...extra }).success).toBe(false);
    }
  });

  it("leaves the size range to the domain", () => {
    expect(SignalInput.parse({ ...validSignal, size: 5 }).size).toBe(5);
    expect(Number.isNaN(SignalInput.parse({ ...validSignal, size: "abc" }).size)).toBe(true);
  });
});

describe("CopyInput", () => {
  it("accepts a copier with or without size", () => {
    expect(CopyInput.parse({ copier: "Ben" })).toEqual({ copier: "Ben", size: undefined });
    expect(CopyInput.parse({ copier: "Ben", size: "0.00004" }).size).toBe(0.00004);
  });

  it("rejects unknown fields and an empty copier", () => {
    expect(CopyInput.safeParse({ copier: "Ben", price: 1 }).success).toBe(false);
    expect(CopyInput.safeParse({ copier: "" }).success).toBe(false);
  });
});

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
