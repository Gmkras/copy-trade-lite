/**
 * The HTTP contract shared by routes and client components.
 *
 * Client-safe: only zod and types, no secrets, no Node APIs.
 *
 * Request schemas are `.strict()` so a body can never smuggle fields such as
 * `builderFee`, `price` or `builderAddr` (constitution S3, E4). The size range
 * (market minimum, MAX_ORDER_SIZE) is NOT checked here on purpose: the single
 * source of truth is `toValidOrderSize` inside `placeMarketOrder`, so every
 * rejection message names the same allowed range.
 */
import { z } from "zod";

export const OrderSide = z.enum(["up", "down"]);
export type OrderSide = z.infer<typeof OrderSide>;

export const OrderInput = z
  .object({
    market: z.string().min(1, "Pick a coin first."),
    side: OrderSide,
    // Accept a number or a numeric string; NaN and the range are judged by the domain.
    size: z.union([z.number(), z.string().min(1)]).transform((value) => Number(value)),
  })
  .strict();
export type OrderInput = z.infer<typeof OrderInput>;

/** Every route answers with this envelope. */
export type ApiOk<T> = { ok: true; data: T };
export type ApiFail = { ok: false; code: string; message: string };
export type ApiEnvelope<T> = ApiOk<T> | ApiFail;

/** GET /api/markets item — human units. */
export type Market = {
  name: string;
  /** "BTC" for "BTC/USD". */
  symbol: string;
  minSize: number;
  sizeStep: number;
  priceStep: number;
  /** MAX_ORDER_SIZE from the server env, so the form can hint the range. */
  maxOrderSize: number;
};

/** GET /api/price/[market]. */
export type Price = {
  market: string;
  mid: number;
  mark: number;
  updatedAt: number;
};

export type Position = {
  market: string;
  symbol: string;
  side: OrderSide;
  /** Absolute size in base units. */
  size: number;
  entryPrice: number;
  markPrice: number;
  pnlUsd: number;
  /** Fraction, e.g. 0.032 for +3.2 %. */
  pnlPct: number;
  liquidationPrice: number;
};

export type OpenOrder = {
  market: string;
  side: OrderSide;
  size: number;
  price: number | null;
  time: number;
};

export type Fill = {
  market: string;
  action: string;
  side: OrderSide;
  size: number;
  price: number;
  fee: number;
  time: number;
};

/** GET /api/account. */
export type AccountState = {
  /** False until the first deposit creates the trading subaccount. */
  exists: boolean;
  equity: number;
  available: number;
  unrealizedPnl: number;
  positions: Position[];
  orders: OpenOrder[];
  fills: Fill[];
  updatedAt: number;
};

/** POST /api/order response. */
export type OrderReceipt = {
  transactionHash: string;
  explorerUrl: string;
  orderId: string | null;
  market: string;
  side: OrderSide;
  size: number;
  referencePrice: number;
  limitPrice: number;
};
