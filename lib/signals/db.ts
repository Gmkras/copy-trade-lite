/**
 * SQLite persistence for signals using Node's built-in `node:sqlite`.
 *
 * Zero native dependencies: `better-sqlite3` has no prebuilt binary for
 * Node 24 on Windows and needs a C++ toolchain; `node:sqlite` ships with Node.
 * One connection per process, created lazily at DB_PATH. Tables are created
 * on first use, so a fresh clone needs no migration step.
 *
 * Not guarded with `server-only` (tests and scripts use it); app code imports
 * through `@/lib/signals` (index.ts), which adds the guard.
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { loadEnv } from "../env.schema";

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS signals (
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
);
CREATE INDEX IF NOT EXISTS signals_created_at ON signals (created_at DESC);

CREATE TABLE IF NOT EXISTS signal_copies (
  id         TEXT PRIMARY KEY,
  signal_id  TEXT    NOT NULL REFERENCES signals (id) ON DELETE CASCADE,
  copier     TEXT    NOT NULL,
  size       REAL    NOT NULL,
  fill_price REAL    NOT NULL,
  tx_hash    TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS signal_copies_signal_id ON signal_copies (signal_id);
`;

/** Opens (or creates) the database at `path` and applies the schema. `:memory:` works for tests. */
export function openDatabase(path: string): DatabaseSync {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA_SQL);
  return db;
}

let instance: DatabaseSync | null = null;

/** Process-wide connection at DB_PATH from the validated env. */
export function getDb(): DatabaseSync {
  if (!instance) instance = openDatabase(loadEnv().DB_PATH);
  return instance;
}
