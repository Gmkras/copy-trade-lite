/**
 * Environment schema and loader.
 *
 * This module has NO `server-only` import on purpose: it is executed by
 * `next.config.ts` inside the Next CLI process (plain Node, not the React
 * Server environment), where `server-only` would throw. App code must import
 * `@/lib/env` instead, which adds the `server-only` guard.
 *
 * Safety rules enforced here (specs/constitution.md §3):
 *  - S1: DECIBEL_NETWORK must be exactly "testnet".
 *  - S3: BUILDER_FEE_BPS is an integer 0..10 (protocol cap).
 *  - S4: MAX_ORDER_SIZE is a positive number (fat-finger cap).
 *  - Error messages never echo values, only variable names and expectations.
 */
import { z } from "zod";

const hexAddress = /^(0x)?[0-9a-fA-F]{1,64}$/;

export const envSchema = z.object({
  PRIVATE_KEY: z
    .string({ required_error: "is required" })
    .min(1, "is required (Ed25519 private key of a TESTNET wallet)"),
  APTOS_NODE_API_KEY: z
    .string({ required_error: "is required" })
    .min(1, "is required (Geomi API key from geomi.dev)"),
  BUILDER_ADDRESS: z
    .string({ required_error: "is required" })
    .regex(hexAddress, "must be a hex Aptos address (1–64 hex chars, optional 0x prefix)"),
  BUILDER_FEE_BPS: z.coerce
    .number({ invalid_type_error: "must be a number" })
    .int("must be an integer")
    .min(0, "must be between 0 and 10 basis points")
    .max(10, "must be between 0 and 10 basis points (protocol cap)"),
  DECIBEL_NETWORK: z.literal("testnet", {
    errorMap: () => ({ message: 'must be exactly "testnet" — mainnet is never allowed' }),
  }),
  MAX_ORDER_SIZE: z.coerce
    .number({ invalid_type_error: "must be a number" })
    .positive("must be a positive number (e.g. 0.01)")
    .default(0.01),
  DB_PATH: z.string().min(1, "must be a file path").default("./data/signals.db"),
});

export type Env = Readonly<z.infer<typeof envSchema>>;

/** Builds one plain-language message listing every invalid variable. Never prints values. */
export function formatEnvErrors(error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const name = issue.path.join(".") || "(root)";
    return `  - ${name} ${issue.message}`;
  });
  return [
    "Invalid environment configuration. The app will not start.",
    ...lines,
    "See .env.example for every variable and where to get it. TESTNET ONLY.",
  ].join("\n");
}

/**
 * Parses `process.env` (or a given source) once. Throws an Error with a
 * readable message on failure so `next dev` / `next build` abort at startup.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(formatEnvErrors(result.error));
  }
  return Object.freeze(result.data);
}
