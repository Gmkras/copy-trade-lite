/**
 * Decibel SDK client, built once per process from the validated environment.
 *
 * NOT guarded with `server-only` on purpose: tsx scripts import this file
 * directly (the guard throws under plain Node). App code must import from
 * `@/lib/decibel` (index.ts), which adds the guard. See design D1.
 *
 * Testnet only: TESTNET_CONFIG is the only configuration ever referenced
 * (constitution S1). The private key never leaves this module's closure.
 */
import {
  Ed25519Account,
  Ed25519PrivateKey,
  PrivateKey,
  PrivateKeyVariants,
} from "@aptos-labs/ts-sdk";
import { DecibelReadDex, DecibelWriteDex, TESTNET_CONFIG } from "@decibeltrade/sdk";

import { loadEnv } from "../env.schema";

export type Decibel = {
  readonly read: DecibelReadDex;
  readonly write: DecibelWriteDex;
  /** Wallet (account) address derived from PRIVATE_KEY. */
  readonly walletAddr: `0x${string}`;
  /** Primary trading subaccount; every account read uses this address. */
  readonly subaccountAddr: `0x${string}`;
  /** Builder address, left-padded to 64 hex chars. */
  readonly builderAddr: `0x${string}`;
  /** Builder fee constant in basis points (0..10). The only source of the per-order fee. */
  readonly feeBps: number;
  /** Fat-finger cap in base units (e.g. BTC). */
  readonly maxOrderSize: number;
  readonly network: "testnet";
};

/** Left-pads an Aptos address to the canonical 64-hex-char form. */
export function padAddress(raw: string): `0x${string}` {
  const hex = raw.trim().replace(/^0x/i, "").toLowerCase();
  if (!/^[0-9a-f]{1,64}$/.test(hex)) {
    throw new Error("Address must be 1–64 hex characters, optionally prefixed with 0x");
  }
  return `0x${hex.padStart(64, "0")}`;
}

let instance: Decibel | null = null;

/** Lazy singleton. Throws the env-validation error if `.env` is invalid. */
export function getDecibel(): Decibel {
  if (instance) return instance;

  const env = loadEnv();

  const formattedKey = PrivateKey.formatPrivateKey(env.PRIVATE_KEY, PrivateKeyVariants.Ed25519);
  const account = new Ed25519Account({ privateKey: new Ed25519PrivateKey(formattedKey) });

  const read = new DecibelReadDex(TESTNET_CONFIG, { nodeApiKey: env.APTOS_NODE_API_KEY });
  const write = new DecibelWriteDex(TESTNET_CONFIG, account, {
    nodeApiKey: env.APTOS_NODE_API_KEY,
    skipSimulate: true,
  });

  instance = Object.freeze({
    read,
    write,
    walletAddr: account.accountAddress.toString() as `0x${string}`,
    subaccountAddr: write.getPrimarySubaccountAddress(account.accountAddress),
    builderAddr: padAddress(env.BUILDER_ADDRESS),
    feeBps: env.BUILDER_FEE_BPS,
    maxOrderSize: env.MAX_ORDER_SIZE,
    network: "testnet",
  });

  return instance;
}
