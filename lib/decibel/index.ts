import "server-only";

/**
 * Public surface of the Decibel layer for app code (route handlers, server
 * components). The `server-only` import above makes the build fail if a
 * Client Component ever imports it — the private key and the write client
 * can never reach the browser (constitution E3).
 *
 * Scripts import the underlying modules directly instead (see client.ts).
 */
export { getDecibel, padAddress, type Decibel } from "./client";
export { emptyAccount, getAccountState, positionPnl, type AccountReader } from "./account";
export {
  assertTradableSize,
  getCandles,
  getCandlesByRange,
  getCandlesFor,
  getCandlesSince,
  getPrice,
  getPrices,
  listMarkets,
  toMarket,
} from "./markets";
export { TradeError, humanizeSdkError, errorText, isNotFoundError, type TradeErrorCode } from "./errors";
export {
  PROTOCOL_MAX_BUILDER_FEE_BPS,
  approveBuilderFee,
  assertFeeBound,
  assertTpSlSides,
  getApprovedBuilderFee,
  placeMarketOrder,
  readBuilderApproval,
  type BuilderApproval,
  type MarketOrderInput,
  type MarketOrderResult,
  type OrderDeps,
} from "./orders";
export {
  baseSymbol,
  floorToLot,
  formatAmount,
  fromChainUnits,
  roundToTick,
  toAggressiveLimitPrice,
  toChainUnits,
  toTickPrice,
  toValidOrderSize,
  type MarketPrecision,
} from "./units";
