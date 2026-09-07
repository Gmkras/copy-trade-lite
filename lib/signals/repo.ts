/**
 * Signal repository over libSQL. Asynchronous, parameterised statements only
 * (no SQL built from strings), every row parsed with zod before it leaves this
 * module so a schema drift fails loudly instead of leaking `undefined` to the UI.
 *
 * `createRepo(db)` takes any libSQL client (`file::memory:` in tests);
 * `signalsRepo()` binds the process-wide database.
 */
import { randomUUID } from "node:crypto";

import type { Client } from "@libsql/client";
import { z } from "zod";

import { symbolOf } from "../format";
import type { AuthorStats, OrderSide, Signal, SignalCopy } from "../schemas";
import { ensureSchema, getDb } from "./db";

const SignalRow = z.object({
  id: z.string(),
  author: z.string(),
  market: z.string(),
  side: z.enum(["up", "down"]),
  entry_price: z.number(),
  tp_pct: z.number(),
  sl_pct: z.number(),
  tp_price: z.number(),
  sl_price: z.number(),
  hold_hours: z.number(),
  size: z.number(),
  note: z.string().nullable(),
  created_at: z.number(),
  expires_at: z.number(),
  outcome: z.enum(["tp", "sl", "expired"]).nullable(),
  copy_count: z.number(),
});

const CopyRow = z.object({
  id: z.string(),
  signal_id: z.string(),
  copier: z.string(),
  size: z.number(),
  fill_price: z.number(),
  tx_hash: z.string(),
  created_at: z.number(),
});

const StatsRow = z.object({
  author: z.string(),
  ideas: z.number(),
  copies: z.number(),
  settled: z.number(),
  won: z.number(),
});

export type NewSignal = {
  author: string;
  market: string;
  side: OrderSide;
  entryPrice: number;
  tpPct: number;
  slPct: number;
  tpPrice: number;
  slPrice: number;
  holdHours: number;
  size: number;
  note?: string | null;
  createdAt: number;
  expiresAt: number;
};

export type NewCopy = {
  copier: string;
  size: number;
  fillPrice: number;
  txHash: string;
  createdAt?: number;
};

const SELECT_SIGNAL = `
  SELECT s.*, (SELECT count(*) FROM signal_copies c WHERE c.signal_id = s.id) AS copy_count
  FROM signals s`;

const INSERT_SIGNAL = `
  INSERT INTO signals (id, author, market, side, entry_price, tp_pct, sl_pct, tp_price, sl_price, hold_hours, size, note, created_at, expires_at, outcome)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`;

const INSERT_COPY = `
  INSERT INTO signal_copies (id, signal_id, copier, size, fill_price, tx_hash, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)`;

const SELECT_COPIES = `SELECT * FROM signal_copies WHERE signal_id = ? ORDER BY created_at ASC`;

/**
 * `count(DISTINCT … CASE …)` and not `sum(...)`: the LEFT JOIN multiplies a
 * signal's row by its number of copies, so a plain sum would count a settled
 * idea once per copy.
 */
const SELECT_STATS = `
  SELECT s.author AS author,
         count(DISTINCT s.id) AS ideas,
         count(c.id) AS copies,
         count(DISTINCT CASE WHEN s.outcome IS NOT NULL THEN s.id END) AS settled,
         count(DISTINCT CASE WHEN s.outcome = 'tp' THEN s.id END) AS won
  FROM signals s LEFT JOIN signal_copies c ON c.signal_id = s.id
  GROUP BY s.author ORDER BY copies DESC, ideas DESC, author ASC`;

/**
 * Records how an idea ended. `AND outcome IS NULL` makes it idempotent: two
 * concurrent feed loads cannot fight, the first writer wins, and a settled
 * idea is never re-judged.
 */
const UPDATE_OUTCOME = `UPDATE signals SET outcome = ? WHERE id = ? AND outcome IS NULL`;

function toSignal(row: z.infer<typeof SignalRow>): Signal {
  return {
    id: row.id,
    author: row.author,
    market: row.market,
    symbol: symbolOf(row.market),
    side: row.side,
    entryPrice: row.entry_price,
    tpPct: row.tp_pct,
    slPct: row.sl_pct,
    tpPrice: row.tp_price,
    slPrice: row.sl_price,
    holdHours: row.hold_hours,
    size: row.size,
    note: row.note,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    outcome: row.outcome,
    copyCount: row.copy_count,
  };
}

function toCopy(row: z.infer<typeof CopyRow>): SignalCopy {
  return {
    id: row.id,
    signalId: row.signal_id,
    copier: row.copier,
    size: row.size,
    fillPrice: row.fill_price,
    txHash: row.tx_hash,
    createdAt: row.created_at,
  };
}

/**
 * libSQL returns each row as an array-like object. zod needs a plain object,
 * and the numeric columns arrive as `bigint` when a value came from `count(*)`
 * on some drivers, so widen them here rather than in every schema.
 */
function plain(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = typeof value === "bigint" ? Number(value) : value;
  }
  return out;
}

export function createRepo(db: Client) {
  const ready = () => ensureSchema(db);

  return {
    async createSignal(input: NewSignal): Promise<Signal> {
      await ready();
      const id = randomUUID();
      await db.execute({
        sql: INSERT_SIGNAL,
        args: [
          id,
          input.author,
          input.market,
          input.side,
          input.entryPrice,
          input.tpPct,
          input.slPct,
          input.tpPrice,
          input.slPrice,
          input.holdHours,
          input.size,
          input.note ?? null,
          input.createdAt,
          input.expiresAt,
        ],
      });
      return (await this.getSignal(id)) as Signal;
    },

    async listSignals(): Promise<Signal[]> {
      await ready();
      const result = await db.execute(`${SELECT_SIGNAL} ORDER BY s.created_at DESC, s.id DESC`);
      return result.rows.map((row) => toSignal(SignalRow.parse(plain(row))));
    },

    async getSignal(id: string): Promise<Signal | null> {
      await ready();
      const result = await db.execute({ sql: `${SELECT_SIGNAL} WHERE s.id = ?`, args: [id] });
      const row = result.rows[0];
      return row ? toSignal(SignalRow.parse(plain(row))) : null;
    },

    async listCopies(signalId: string): Promise<SignalCopy[]> {
      await ready();
      const result = await db.execute({ sql: SELECT_COPIES, args: [signalId] });
      return result.rows.map((row) => toCopy(CopyRow.parse(plain(row))));
    },

    async addCopy(signalId: string, input: NewCopy): Promise<SignalCopy> {
      await ready();
      const id = randomUUID();
      const createdAt = input.createdAt ?? Date.now();
      await db.execute({
        sql: INSERT_COPY,
        args: [id, signalId, input.copier, input.size, input.fillPrice, input.txHash, createdAt],
      });
      return {
        id,
        signalId,
        copier: input.copier,
        size: input.size,
        fillPrice: input.fillPrice,
        txHash: input.txHash,
        createdAt,
      };
    },

    async setOutcome(id: string, outcome: "tp" | "sl" | "expired"): Promise<void> {
      await ready();
      await db.execute({ sql: UPDATE_OUTCOME, args: [outcome, id] });
    },

    async authorStats(): Promise<AuthorStats[]> {
      await ready();
      const result = await db.execute(SELECT_STATS);
      return result.rows.map((row) => StatsRow.parse(plain(row)));
    },
  };
}

export type SignalsRepo = ReturnType<typeof createRepo>;

let repo: SignalsRepo | null = null;

/** Repository bound to the process-wide database at DATABASE_URL. */
export function signalsRepo(): SignalsRepo {
  if (!repo) repo = createRepo(getDb());
  return repo;
}
