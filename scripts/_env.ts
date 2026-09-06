/**
 * Shared runner for the tsx scripts: loads `.env`, runs `main`, and turns any
 * failure into one readable line (plus the cause with --verbose). Exits
 * explicitly because the SDK may keep sockets open.
 */
import { TradeError, humanizeSdkError } from "../lib/decibel/errors";

const VERBOSE = process.argv.includes("--verbose");

/** Positional args without flags. */
export function positionalArgs(): string[] {
  return process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
}

export function loadDotEnv(): void {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env: loadEnv() will explain exactly which variables are missing.
  }
}

export function run(main: () => Promise<void>): void {
  loadDotEnv();
  main()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      const message =
        error instanceof TradeError
          ? error.message
          : error instanceof Error && error.message.startsWith("Invalid environment configuration")
            ? error.message
            : humanizeSdkError(error).message;
      console.error(`\n✗ ${message}`);
      if (VERBOSE) {
        console.error("\n--- cause ---");
        console.error(error instanceof TradeError && error.cause !== undefined ? error.cause : error);
      } else {
        console.error("  (run with --verbose to see the underlying error)");
      }
      process.exit(1);
    });
}

export const EXPLORER = "https://explorer.aptoslabs.com";

export function txUrl(hash: string): string {
  return `${EXPLORER}/txn/${hash}?network=testnet`;
}

export function money(value: number, digits = 2): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
