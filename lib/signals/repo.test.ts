import type { Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDb } from "./db";
import { createRepo, type NewSignal, type SignalsRepo } from "./repo";

const base: NewSignal = {
  author: "Ana",
  market: "BTC/USD",
  side: "up",
  entryPrice: 80_000,
  tpPct: 3,
  slPct: 2,
  tpPrice: 82_400,
  slPrice: 78_400,
  holdHours: 4,
  size: 0.00002,
  createdAt: 1_000,
  expiresAt: 1_000 + 4 * 3_600_000,
};

describe("signals repo (libSQL, in memory)", () => {
  let db: Client;
  let repo: SignalsRepo;

  beforeEach(() => {
    db = createDb("file::memory:");
    repo = createRepo(db);
  });

  afterEach(() => db.close());

  it("creates a signal and reads it back with symbol and copyCount 0", async () => {
    const s = await repo.createSignal(base);
    expect(s.id).toMatch(/[0-9a-f-]{36}/);
    expect(s).toMatchObject({ author: "Ana", market: "BTC/USD", symbol: "BTC", side: "up", tpPrice: 82_400, copyCount: 0, note: null, outcome: null });
    expect(await repo.getSignal(s.id)).toEqual(s);
  });

  it("lists newest first", async () => {
    const a = await repo.createSignal({ ...base, createdAt: 1_000 });
    const b = await repo.createSignal({ ...base, author: "Ben", createdAt: 2_000 });
    expect((await repo.listSignals()).map((s) => s.id)).toEqual([b.id, a.id]);
  });

  it("counts copies and lists them in order", async () => {
    const s = await repo.createSignal(base);
    await repo.addCopy(s.id, { copier: "Ben", size: 0.00002, fillPrice: 80_100, txHash: "0xaaa", createdAt: 5_000 });
    await repo.addCopy(s.id, { copier: "Cid", size: 0.00004, fillPrice: 80_200, txHash: "0xbbb", createdAt: 6_000 });
    expect((await repo.getSignal(s.id))?.copyCount).toBe(2);
    const copies = await repo.listCopies(s.id);
    expect(copies.map((c) => c.copier)).toEqual(["Ben", "Cid"]);
    expect(copies[0]).toMatchObject({ signalId: s.id, txHash: "0xaaa", fillPrice: 80_100 });
  });

  it("aggregates author stats", async () => {
    const a = await repo.createSignal(base);
    await repo.createSignal({ ...base, createdAt: 2_000 });
    await repo.createSignal({ ...base, author: "Ben", createdAt: 3_000 });
    await repo.addCopy(a.id, { copier: "Ben", size: 0.00002, fillPrice: 80_000, txHash: "0x1" });
    await repo.addCopy(a.id, { copier: "Cid", size: 0.00002, fillPrice: 80_000, txHash: "0x2" });
    expect(await repo.authorStats()).toEqual([
      { author: "Ana", ideas: 2, copies: 2 },
      { author: "Ben", ideas: 1, copies: 0 },
    ]);
  });

  it("returns null for an unknown id and rejects a copy of an unknown signal", async () => {
    expect(await repo.getSignal("nope")).toBeNull();
    await expect(repo.addCopy("nope", { copier: "x", size: 1, fillPrice: 1, txHash: "0x" })).rejects.toThrow(/FOREIGN KEY/i);
  });

  it("stores and returns the note", async () => {
    const s = await repo.createSignal({ ...base, note: "BTC looks strong today" });
    expect((await repo.getSignal(s.id))?.note).toBe("BTC looks strong today");
  });
});
