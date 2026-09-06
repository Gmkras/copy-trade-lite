/**
 * Signal repository over `node:sqlite`. Synchronous, prepared statements only
 * (no SQL built from strings), every row parsed with zod before it leaves this
 * module so a schema drift fails loudly instead of leaking `undefined` to the UI.
 *
 * `createRepo(db)` takes any DatabaseSync (`:memory:` in tests); `signalsRepo()`
 * binds the process-wide database.
 */
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import { z } from "zod";

import { symbolOf } from "../format";
import type { AuthorStats, OrderSide, Signal, SignalCopy } from "../schemas";
import { getDb } from "./db";

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

const StatsRow = z.object({ author: z.string(), ideas: z.number(), copies: z.number() });

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

export function createRepo(db: DatabaseSync) {
  const insertSignal = db.prepare(`
    INSERT INTO signals (id, author, market, side, entry_price, tp_pct, sl_pct, tp_price, sl_price, hold_hours, size, note, created_at, expires_at, outcome)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`);
  const selectAll = db.prepare(`${SELECT_SIGNAL} ORDER BY s.created_at DESC, s.id DESC`);
  const selectOne = db.prepare(`${SELECT_SIGNAL} WHERE s.id = ?`);
  const selectCopies = db.prepare(`SELECT * FROM signal_copies WHERE signal_id = ? ORDER BY created_at ASC`);
  const insertCopy = db.prepare(`
    INSERT INTO signal_copies (id, signal_id, copier, size, fill_price, tx_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const selectStats = db.prepare(`
    SELECT s.author AS author, count(DISTINCT s.id) AS ideas, count(c.id) AS copies
    FROM signals s LEFT JOIN signal_copies c ON c.signal_id = s.id
    GROUP BY s.author ORDER BY copies DESC, ideas DESC, author ASC`);

  return {
    createSignal(input: NewSignal): Signal {
      const id = randomUUID();
      insertSignal.run(
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
      );
      return this.getSignal(id) as Signal;
    },

    listSignals(): Signal[] {
      return selectAll.all().map((row) => toSignal(SignalRow.parse(row)));
    },

    getSignal(id: string): Signal | null {
      const row = selectOne.get(id);
      return row ? toSignal(SignalRow.parse(row)) : null;
    },

    listCopies(signalId: string): SignalCopy[] {
      return selectCopies.all(signalId).map((row) => toCopy(CopyRow.parse(row)));
    },

    addCopy(signalId: string, input: NewCopy): SignalCopy {
      const id = randomUUID();
      const createdAt = input.createdAt ?? Date.now();
      insertCopy.run(id, signalId, input.copier, input.size, input.fillPrice, input.txHash, createdAt);
      return { id, signalId, copier: input.copier, size: input.size, fillPrice: input.fillPrice, txHash: input.txHash, createdAt };
    },

    authorStats(): AuthorStats[] {
      return selectStats.all().map((row) => StatsRow.parse(row));
    },
  };
}

export type SignalsRepo = ReturnType<typeof createRepo>;

let repo: SignalsRepo | null = null;

/** Repository bound to the process-wide database at DB_PATH. */
export function signalsRepo(): SignalsRepo {
  if (!repo) repo = createRepo(getDb());
  return repo;
}
