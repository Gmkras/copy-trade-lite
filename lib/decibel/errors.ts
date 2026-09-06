/**
 * Error taxonomy for everything that touches Decibel (constitution S5: every
 * unhappy path becomes one readable sentence, nothing is swallowed).
 */
export type TradeErrorCode =
  | "INVALID_SIZE"
  | "UNKNOWN_MARKET"
  | "NO_PRICE"
  | "TPSL_SIDE"
  | "FEE_BOUND"
  | "INSUFFICIENT_BALANCE"
  | "NO_GAS"
  | "API_KEY_REJECTED"
  | "TX_REJECTED"
  | "NETWORK"
  | "UNKNOWN";

export class TradeError extends Error {
  readonly code: TradeErrorCode;

  constructor(code: TradeErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "TradeError";
    this.code = code;
  }
}

const FAUCET_URL = "https://aptos.dev/network/faucet";
const GEOMI_URL = "https://geomi.dev";

/** Extracts a readable string from whatever the SDK or fetch threw. */
export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Maps raw SDK / Aptos / network errors to plain-language TradeErrors.
 * The original error is always kept on `cause`; nothing is hidden.
 */
export function humanizeSdkError(error: unknown): TradeError {
  if (error instanceof TradeError) return error;

  const raw = errorText(error);
  const text = raw.toLowerCase();
  const withCause = { cause: error };

  if (text.includes("401") || text.includes("anonymous") || text.includes("unauthorized")) {
    return new TradeError(
      "API_KEY_REJECTED",
      `Your Geomi API key was rejected. Create a Testnet key at ${GEOMI_URL} and put it in APTOS_NODE_API_KEY.`,
      withCause,
    );
  }

  if (text.includes("insufficient_balance_for_transaction_fee") || text.includes("gas")) {
    return new TradeError(
      "NO_GAS",
      `The wallet has no testnet APT to pay network fees. Get some at ${FAUCET_URL}.`,
      withCause,
    );
  }

  if (
    text.includes("insufficient") ||
    text.includes("margin") ||
    text.includes("collateral") ||
    text.includes("balance")
  ) {
    return new TradeError(
      "INSUFFICIENT_BALANCE",
      "Not enough play money in the trading account. Run `pnpm mint` to add test USDC.",
      withCause,
    );
  }

  if (
    text.includes("fetch failed") ||
    text.includes("econn") ||
    text.includes("enotfound") ||
    text.includes("timeout") ||
    text.includes("network")
  ) {
    return new TradeError(
      "NETWORK",
      "Could not reach Aptos testnet. Check your connection and try again.",
      withCause,
    );
  }

  if (text.includes("rejected") || text.includes("aborted") || text.includes("vm_status")) {
    return new TradeError(
      "TX_REJECTED",
      `The transaction was rejected by the chain: ${shorten(raw)}`,
      withCause,
    );
  }

  return new TradeError("UNKNOWN", `Something went wrong: ${shorten(raw)}`, withCause);
}

function shorten(text: string, max = 160): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}
