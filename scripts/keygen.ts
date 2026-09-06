/**
 * Generates a brand-new Ed25519 account for Aptos TESTNET.
 *
 * This script prints a private key on purpose — that is its only job. Paste
 * it into `.env` as PRIVATE_KEY and never commit it. Nothing is written to disk.
 *
 *   pnpm keygen
 */
import { Ed25519Account } from "@aptos-labs/ts-sdk";

const account = Ed25519Account.generate();

console.log("New Aptos TESTNET account (nothing was saved to disk)\n");
console.log(`address      ${account.accountAddress.toString()}`);
console.log(`PRIVATE_KEY  ${account.privateKey.toString()}`);
console.log("\nNext steps:");
console.log("  1. Put PRIVATE_KEY (and, if you like, address as BUILDER_ADDRESS) in .env");
console.log("  2. Get testnet APT for gas: https://aptos.dev/network/faucet");
console.log("  3. pnpm smoke  →  pnpm mint  →  pnpm approve");
console.log("\nTESTNET ONLY. Never use this key with real funds.");
