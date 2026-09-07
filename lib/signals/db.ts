/**
 * SQL persistence for signals over libSQL.
 *
 * One code path for both environments: `DATABASE_URL` is `file:./data/signals.db`
 * locally and a `libsql://…` URL when deployed, because a serverless filesystem
 * is discarded between invocations. The dialect is SQLite either way, so the
 * schema and every statement are identical.
 *
 * Not guarded with `server-only` (tests and scripts use it); app code imports
 * through `@/lib/signals` (index.ts), which adds the guard.
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { createClient, type Client } from "@libsql/client";

import { loadEnv } from "../env.schema";

/** Each statement runs on its own: libSQL batches them in one round trip. */
export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS signals (
    id          TEXT PRIMARY KEY,
    author      TEXT    NOT NULL,
    market      TEXT    NOT NULL,
    side        TEXT    NOT NULL CHECK (side IN ('up', 'down')),
    entry_price REAL    NOT NULL,
    tp_pct      REAL    NOT NULL,
    sl_pct      REAL    NOT NULL,
    tp_price    REAL    NOT NULL,
    sl_price    REAL    NOT NULL,
    hold_hours  REAL    NOT NULL,
    size        REAL    NOT NULL,
    note        TEXT,
    created_at  INTEGER NOT NULL,
    expires_at  INTEGER NOT NULL,
    outcome     TEXT    CHECK (outcome IN ('tp', 'sl', 'expired'))
  )`,
  `CREATE INDEX IF NOT EXISTS signals_created_at ON signals (created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS signal_copies (
    id         TEXT PRIMARY KEY,
    signal_id  TEXT    NOT NULL REFERENCES signals (id) ON DELETE CASCADE,
    copier     TEXT    NOT NULL,
    size       REAL    NOT NULL,
    fill_price REAL    NOT NULL,
    tx_hash    TEXT    NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS signal_copies_signal_id ON signal_copies (signal_id)`,
  // What `pnpm approve` recorded, so orders can assert the fee bound from any
  // process that shares this database (a serverless deploy has no local files).
  `CREATE TABLE IF NOT EXISTS builder_approvals (
    subaccount_addr  TEXT    NOT NULL,
    builder_addr     TEXT    NOT NULL,
    max_fee_bps      INTEGER NOT NULL,
    transaction_hash TEXT    NOT NULL,
    approved_at      TEXT    NOT NULL,
    PRIMARY KEY (subaccount_addr, builder_addr)
  )`,
];

/** Creates a client for `url`. A `file:` URL gets its directory created first. */
export function createDb(url: string, authToken?: string): Client {
  if (url.startsWith("file:")) {
    const path = url.slice("file:".length);
    if (path && path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  }
  return createClient({ url, ...(authToken ? { authToken } : {}) });
}

const schemaReady = new WeakMap<Client, Promise<void>>();

/**
 * Applies the schema once per client. The promise is cached, so concurrent
 * requests on a cold serverless instance wait for the same batch instead of
 * racing each other.
 */
export function ensureSchema(db: Client): Promise<void> {
  let ready = schemaReady.get(db);
  if (!ready) {
    ready = db.batch(SCHEMA_STATEMENTS, "write").then(() => undefined);
    schemaReady.set(db, ready);
  }
  return ready;
}

let instance: Client | null = null;

/** Process-wide client for DATABASE_URL from the validated env. */
export function getDb(): Client {
  if (!instance) {
    const env = loadEnv();
    instance = createDb(env.DATABASE_URL, env.DATABASE_AUTH_TOKEN);
  }
  return instance;
}
