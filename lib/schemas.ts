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

/** Accepts a number or a numeric string; NaN and the range are judged by the domain (toValidOrderSize). */
export const sizeField = z.union([z.number(), z.string().min(1)]).transform((value) => Number(value));

export const OrderInput = z
  .object({
    market: z.string().min(1, "Pick a coin first."),
    side: OrderSide,
    size: sizeField,
  })
  .strict();
export type OrderInput = z.infer<typeof OrderInput>;

const displayName = z.string().trim().min(1, "Add a name.").max(40, "Keep the name under 40 characters.");
const percent = (label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} must be a number.` })
    .gt(0, `${label} must be more than 0%.`)
    .lt(100, `${label} must be less than 100%.`);

/** POST /api/signals body. The entry price is never accepted from the client. */
export const SignalInput = z
  .object({
    author: displayName,
    market: z.string().min(1, "Pick a coin first."),
    side: OrderSide,
    tpPct: percent("Take profit"),
    slPct: percent("Stop loss"),
    holdHours: z.coerce
      .number({ invalid_type_error: "Hold time must be a number of hours." })
      .min(1, "Hold the idea for at least 1 hour.")
      .max(720, "Hold the idea for at most 720 hours (30 days)."),
    size: sizeField,
    note: z.string().trim().max(140, "Keep the note under 140 characters.").optional(),
  })
  .strict();
export type SignalInput = z.infer<typeof SignalInput>;

/** POST /api/signals/[id]/copy body. Size defaults to the author's. */
export const CopyInput = z
  .object({
    copier: displayName,
    size: sizeField.optional(),
  })
  .strict();
export type CopyInput = z.infer<typeof CopyInput>;

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

/** A posted trade idea (GET /api/signals item). */
export type Signal = {
  id: string;
  author: string;
  market: string;
  symbol: string;
  side: OrderSide;
  entryPrice: number;
  tpPct: number;
  slPct: number;
  tpPrice: number;
  slPrice: number;
  holdHours: number;
  size: number;
  note: string | null;
  createdAt: number;
  expiresAt: number;
  outcome: "tp" | "sl" | "expired" | null;
  copyCount: number;
};

export type SignalCopy = {
  id: string;
  signalId: string;
  copier: string;
  size: number;
  /**
   * Reference (mid) price when the copy was placed, not a confirmed fill:
   * an immediate-or-cancel order can be sent without filling. The UI says
   * "at about $…" for this reason.
   */
  fillPrice: number;
  txHash: string;
  createdAt: number;
};

export type AuthorStats = {
  author: string;
  ideas: number;
  copies: number;
};

/** A signal plus whether it can still be copied. */
export type SignalView = Signal & { expired: boolean };

/** GET /api/signals. */
export type SignalList = {
  signals: SignalView[];
  authors: AuthorStats[];
  /** Live mid per market that has a live idea; a market that could not be quoted is absent. */
  prices: Record<string, number>;
  /** Last hour of one-minute candles per market with a live idea; absent when they could not be read. */
  candles: Record<string, Candle[]>;
  updatedAt: number;
};

/** One candle for the chart (ms timestamps); the interval depends on the range asked for. */
export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

/** How much history a chart shows. Each range maps to one candle interval (lib/charts.ts). */
export const CandleRange = z.enum(["1h", "4h", "1d", "1w"], {
  errorMap: () => ({ message: "Choose a range of 1h, 4h, 1d or 1w." }),
});
export type CandleRange = z.infer<typeof CandleRange>;

/** Query of GET /api/candles/[market]. */
export const CandlesQuery = z.object({ range: CandleRange.default("1h") }).strict();

/** GET /api/candles/[market] response. */
export type CandlesResponse = {
  market: string;
  range: CandleRange;
  interval: string;
  candles: Candle[];
};

/** GET /api/signals/[id]. */
export type SignalDetail = {
  signal: SignalView;
  copies: SignalCopy[];
  price: Price | null;
  priceError: string | null;
  candles: Candle[];
  candlesError: string | null;
};

/** POST /api/signals/[id]/copy response. */
export type CopyReceipt = OrderReceipt & {
  copyId: string | null;
  copyCount: number;
  /** False when the exchange rejected the trigger prices and the order was placed without them. */
  tpSlAttached: boolean;
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
