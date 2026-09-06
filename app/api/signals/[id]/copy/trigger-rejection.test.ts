import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@decibeltrade/sdk", () => ({
  TimeInForce: { GoodTillCanceled: 0, PostOnly: 1, ImmediateOrCancel: 2 },
  TESTNET_CONFIG: {},
  DecibelReadDex: class {},
  DecibelWriteDex: class {},
}));

import { TradeError } from "@/lib/decibel/errors";
import { isTriggerPriceRejection } from "./route";

const rejected = (cause: string) => new TradeError("TX_REJECTED", "The transaction was rejected by the chain.", { cause: new Error(cause) });

describe("isTriggerPriceRejection", () => {
  it("recognises rejections that name the trigger prices", () => {
    for (const cause of [
      "Move abort in 0xabc::perp_engine: EINVALID_TP_TRIGGER_PRICE(0x5)",
      "invalid tp_trigger_price for this order type",
      "sl_limit_price must be below entry",
      "take_profit not allowed on IOC orders",
      "STOP_LOSS trigger rejected",
    ]) {
      expect(isTriggerPriceRejection(rejected(cause))).toBe(true);
    }
  });

  it("does not fire on unrelated rejections, even when the text contains a URL", () => {
    // "http" contains "tp": a loose pattern here would place a second order.
    for (const cause of [
      "FetchError: https://api.testnet.aptoslabs.com/v1 returned 500",
      "Move abort in 0xabc::dex_accounts_entry: EBUILDER_SUBACCOUNT_NOT_FOUND(0x1)",
      "Move abort in 0xabc::perp_engine: EINSUFFICIENT_MARGIN(0x9)",
      "slippage too high",
      "please sleep and retry",
    ]) {
      expect(isTriggerPriceRejection(rejected(cause))).toBe(false);
    }
  });

  it("ignores anything that is not a chain rejection", () => {
    expect(isTriggerPriceRejection(new TradeError("INVALID_SIZE", "tp_trigger_price"))).toBe(false);
    expect(isTriggerPriceRejection(new Error("tp_trigger_price"))).toBe(false);
    expect(isTriggerPriceRejection(null)).toBe(false);
  });
});
