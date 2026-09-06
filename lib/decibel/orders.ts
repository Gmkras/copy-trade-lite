/**
 * Order execution with builder codes and safety bounds (constitution S3, S4, S5).
 *
 * Not guarded with `server-only` (scripts use it); app code imports it through
 * `@/lib/decibel` (index.ts), which is guarded.
 *
 * The builder fee is never a parameter: it comes from the env constant on the
 * client and is asserted against the recorded approval and the protocol cap
 * immediately before the transaction is built.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { TimeInForce } from "@decibeltrade/sdk";
import type { PlaceOrderResult } from "@decibeltrade/sdk";

import { getDecibel } from "./client";
import { TradeError, humanizeSdkError } from "./errors";
import {
  baseSymbol,
  fromChainUnits,
  toAggressiveLimitPrice,
  toTickPrice,
  toValidOrderSize,
  type MarketPrecision,
} from "./units";

/** Protocol-wide cap for builder fees, in basis points. */
export const PROTOCOL_MAX_BUILDER_FEE_BPS = 10;

/** Where the approve script records what it approved (gitignored `data/`). */
export const APPROVAL_RECORD_PATH = "data/builder-approval.json";

export type BuilderApproval = {
  builderAddr: string;
  subaccountAddr: string;
  maxFeeBps: number;
  transactionHash: string;
  approvedAt: string;
};

export type MarketOrderInput = {
  marketName: string;
  isBuy: boolean;
  /** Human size in base units (e.g. BTC). */
  size: number;
  /** Optional take-profit trigger, human price. */
  tpPrice?: number;
  /** Optional stop-loss trigger, human price. */
  slPrice?: number;
  /** Fraction through the mid for the IOC limit (default 0.5 %). */
  slippage?: number;
};

export type MarketOrderResult = {
  transactionHash: string;
  orderId: string | undefined;
  /** Mid price used as reference, human. */
  referencePrice: number;
  /** Limit price actually sent, human. */
  limitPrice: number;
  /** Size actually sent, human (after lot flooring). */
  size: number;
  sizeUnits: number;
  marketName: string;
  isBuy: boolean;
};

/**
 * Everything `placeMarketOrder` needs from the outside world, so tests can
 * inject fakes and never touch the network.
 */
export type OrderDeps = {
  feeBps: number;
  maxOrderSize: number;
  builderAddr: string;
  subaccountAddr: string;
  getMarkets: () => Promise<MarketPrecision[]>;
  getMidPrice: (marketName: string) => Promise<number | undefined>;
  getApprovedFeeBps: () => number | null;
  placeOrder: (args: {
    marketName: string;
    price: number;
    size: number;
    isBuy: boolean;
    tpTriggerPrice?: number;
    slTriggerPrice?: number;
    builderAddr: string;
    builderFee: number;
    tickSize: number;
    subaccountAddr: string;
  }) => Promise<PlaceOrderResult>;
};

/** Reads the approval the approve script recorded, or null if it never ran. */
export function readBuilderApproval(path = APPROVAL_RECORD_PATH): BuilderApproval | null {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<BuilderApproval>;
    if (
      typeof parsed.builderAddr !== "string" ||
      typeof parsed.subaccountAddr !== "string" ||
      typeof parsed.maxFeeBps !== "number" ||
      typeof parsed.transactionHash !== "string"
    ) {
      return null;
    }
    return parsed as BuilderApproval;
  } catch {
    return null;
  }
}

function writeBuilderApproval(record: BuilderApproval, path = APPROVAL_RECORD_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(record, null, 2) + "\n", "utf8");
}

/** The approved max fee for the configured builder/subaccount, if recorded. */
export function getApprovedBuilderFee(): number | null {
  const d = getDecibel();
  const record = readBuilderApproval();
  if (!record) return null;
  if (record.builderAddr !== d.builderAddr || record.subaccountAddr !== d.subaccountAddr) return null;
  return record.maxFeeBps;
}

/**
 * Step 1 of builder codes: approve the builder for at most `feeBps` on the
 * primary subaccount. Refuses anything above the protocol cap. Idempotent.
 */
export async function approveBuilderFee(): Promise<BuilderApproval> {
  const d = getDecibel();
  if (d.feeBps > PROTOCOL_MAX_BUILDER_FEE_BPS) {
    throw new TradeError(
      "FEE_BOUND",
      `BUILDER_FEE_BPS is ${d.feeBps} but the protocol cap is ${PROTOCOL_MAX_BUILDER_FEE_BPS} bps.`,
    );
  }
  let hash: string;
  try {
    const tx = await d.write.approveMaxBuilderFee({
      builderAddr: d.builderAddr,
      maxFee: d.feeBps,
      subaccountAddr: d.subaccountAddr,
    });
    if (!tx.success) {
      throw new TradeError("TX_REJECTED", `Approval transaction failed on chain: ${tx.vm_status}`);
    }
    hash = tx.hash;
  } catch (error) {
    throw humanizeSdkError(error);
  }
  const record: BuilderApproval = {
    builderAddr: d.builderAddr,
    subaccountAddr: d.subaccountAddr,
    maxFeeBps: d.feeBps,
    transactionHash: hash,
    approvedAt: new Date().toISOString(),
  };
  writeBuilderApproval(record);
  return record;
}

/**
 * Asserts the fee bound. Called immediately before the transaction is built;
 * nothing after this point can change the fee.
 */
export function assertFeeBound(feeBps: number, approvedMaxBps: number | null): void {
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > PROTOCOL_MAX_BUILDER_FEE_BPS) {
    throw new TradeError(
      "FEE_BOUND",
      `Builder fee ${feeBps} bps is outside the protocol cap of 0–${PROTOCOL_MAX_BUILDER_FEE_BPS} bps.`,
    );
  }
  if (approvedMaxBps === null) {
    throw new TradeError(
      "FEE_BOUND",
      "The builder fee has not been approved yet. Run `pnpm approve` once before trading.",
    );
  }
  if (feeBps > approvedMaxBps) {
    throw new TradeError(
      "FEE_BOUND",
      `Builder fee ${feeBps} bps exceeds the approved maximum of ${approvedMaxBps} bps. Run \`pnpm approve\` to raise it (cap ${PROTOCOL_MAX_BUILDER_FEE_BPS} bps).`,
    );
  }
}

/** Long: TP above entry, SL below. Short: mirrored. Throws before anything is signed. */
export function assertTpSlSides(isBuy: boolean, entry: number, tpPrice?: number, slPrice?: number): void {
  const side = isBuy ? "Up" : "Down";
  if (tpPrice !== undefined) {
    if (!Number.isFinite(tpPrice) || tpPrice <= 0) {
      throw new TradeError("TPSL_SIDE", "Take profit must be a positive price.");
    }
    if (isBuy ? tpPrice <= entry : tpPrice >= entry) {
      throw new TradeError(
        "TPSL_SIDE",
        `For an ${side} trade the take profit must be ${isBuy ? "above" : "below"} the entry price (${entry}).`,
      );
    }
  }
  if (slPrice !== undefined) {
    if (!Number.isFinite(slPrice) || slPrice <= 0) {
      throw new TradeError("TPSL_SIDE", "Stop loss must be a positive price.");
    }
    if (isBuy ? slPrice >= entry : slPrice <= entry) {
      throw new TradeError(
        "TPSL_SIDE",
        `For an ${side} trade the stop loss must be ${isBuy ? "below" : "above"} the entry price (${entry}).`,
      );
    }
  }
}

function liveDeps(): OrderDeps {
  const d = getDecibel();
  return {
    feeBps: d.feeBps,
    maxOrderSize: d.maxOrderSize,
    builderAddr: d.builderAddr,
    subaccountAddr: d.subaccountAddr,
    getMarkets: () => d.read.markets.getAll(),
    getMidPrice: async (marketName) => {
      const [price] = await d.read.marketPrices.getByName({ marketName });
      return price?.mid_px;
    },
    getApprovedFeeBps: () => getApprovedBuilderFee(),
    placeOrder: (args) =>
      d.write.placeOrder({
        ...args,
        timeInForce: TimeInForce.ImmediateOrCancel,
        isReduceOnly: false,
      }),
  };
}

/**
 * Places a "market" order: an immediate-or-cancel limit priced through the
 * live mid, with the builder code attached. Every safety check happens before
 * the transaction is built; success is never returned without a hash.
 */
export async function placeMarketOrder(
  input: MarketOrderInput,
  deps: OrderDeps = liveDeps(),
): Promise<MarketOrderResult> {
  // 1. Market must exist.
  const markets = await deps.getMarkets();
  const market = markets.find((m) => m.market_name === input.marketName);
  if (!market) {
    throw new TradeError("UNKNOWN_MARKET", `Unknown market "${input.marketName}".`);
  }

  // 2. Size validated and converted before any pricing.
  const sizeUnits = toValidOrderSize(input.size, market, deps.maxOrderSize);

  // 3. Live reference price.
  const mid = await deps.getMidPrice(market.market_name);
  if (mid === undefined || !Number.isFinite(mid) || mid <= 0) {
    throw new TradeError("NO_PRICE", `No live price for ${baseSymbol(market.market_name)} right now. Try again in a moment.`);
  }

  // 4. TP/SL sides against the reference price.
  assertTpSlSides(input.isBuy, mid, input.tpPrice, input.slPrice);
  const tpTriggerPrice = input.tpPrice === undefined ? undefined : toTickPrice(input.tpPrice, market);
  const slTriggerPrice = input.slPrice === undefined ? undefined : toTickPrice(input.slPrice, market);

  // 5. Fee bound — the last thing before the transaction is built.
  assertFeeBound(deps.feeBps, deps.getApprovedFeeBps());

  // 6. Sign and submit.
  const priceUnits = toAggressiveLimitPrice(mid, input.isBuy, market, input.slippage);
  let result: PlaceOrderResult;
  try {
    result = await deps.placeOrder({
      marketName: market.market_name,
      price: priceUnits,
      size: sizeUnits,
      isBuy: input.isBuy,
      tpTriggerPrice,
      slTriggerPrice,
      builderAddr: deps.builderAddr,
      builderFee: deps.feeBps,
      tickSize: market.tick_size,
      subaccountAddr: deps.subaccountAddr,
    });
  } catch (error) {
    throw humanizeSdkError(error);
  }

  // 7. Never report success without a transaction hash.
  if (!result.success) {
    throw humanizeSdkError(result.error);
  }
  if (!result.transactionHash) {
    throw new TradeError("UNKNOWN", "The order returned no transaction hash; treat it as not placed.");
  }

  return {
    transactionHash: result.transactionHash,
    orderId: result.orderId,
    referencePrice: mid,
    limitPrice: fromChainUnits(priceUnits, market.px_decimals),
    size: fromChainUnits(sizeUnits, market.sz_decimals),
    sizeUnits,
    marketName: market.market_name,
    isBuy: input.isBuy,
  };
}
