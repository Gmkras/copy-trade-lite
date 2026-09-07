## Context

`lib/signals/feed.ts` is the one loader for `/` and `GET /api/signals`: it reads signals and author stats in parallel, then fetches live prices and one hour of candles for the markets with live ideas. `lib/signals/repo.ts` already selects `outcome` and `SignalRow` already parses `z.enum(["tp","sl","expired"]).nullable()`, but `INSERT_SIGNAL` writes `NULL` and nothing ever updates it. `getCandles(market, { interval, count })` derives `startTime` from `count × intervalMs`, so there is no way today to ask for "everything since a timestamp". `lib/charts.ts` already owns the range→interval ladder. `AuthorStats` is `{ author, ideas, copies }`, computed by one SQL `LEFT JOIN`. Cards and the detail show "live · 3h left" or "expired", the latter derived from the clock by `isExpired`, not from the stored column. See proposal.md for why.

## Goals / Non-Goals

**Goals:**
- One rule, one place, testable without the network: given candles and levels, the outcome is a pure function.
- Cheap: one candle read per market per feed load, and only while something is unsettled.
- Honest: never claim a win the data does not support.

**Non-Goals:**
- Fills-based settlement, re-settlement, a leaderboard page, or any change to the order path.

## Decisions

### D1. `settleSignal(signal, candles, now)` is pure and lives in `lib/signals/outcome.ts`
Signature: `(signal: {side, tpPrice, slPrice, createdAt, expiresAt}, candles: Candle[], now: number) => "tp" | "sl" | "expired" | null`. It walks the candles at or after `createdAt` and at or before `min(now, expiresAt)`:

- Up idea: `high >= tpPrice` is a take profit, `low <= slPrice` is a stop loss. Down idea: `low <= tpPrice` and `high >= slPrice`.
- **Both in the same candle → `sl`.** The order inside a candle is unknowable and the conservative reading is the one that does not claim a win (constitution S6 "don't fake it"). This is the single most important line in the file and it gets its own test.
- Neither, and `now >= expiresAt` → `expired`. Neither, still inside the hold → `null` (leave it open).

Being pure means the tests cover Up, Down, the both-in-one-candle case, the expiry boundary, empty candles and candles outside the window, with no SDK and no clock.

### D2. Coarser candles do not lose crossings, only ordering
An aggregated candle keeps the extremes of its period: a 15-minute candle's `high` is the highest tick in those fifteen minutes. So a wick that touched the take profit is still visible at any interval — what a coarse interval loses is the *order* of two crossings inside one candle, which D1 already resolves conservatively. That is why choosing the interval by span (below) is safe, and it is the answer to "does a 1-hour candle miss a spike?".

### D3. One fetch per market, sized by the oldest unsettled idea
New `getCandlesSince(marketName, sinceMs)` in `lib/decibel/markets.ts`: it picks the interval from the span (`≤ 4 h → 1m`, `≤ 1 d → 5m`, `≤ 7 d → 15m`, else `1h`, reusing the ladder in `lib/charts.ts`) and asks the SDK with `startTime = sinceMs`, `endTime = Date.now()`. `settleAll(signals, now, deps)` in `outcome.ts` then:

1. keeps signals with `outcome === null`;
2. groups them by market and takes the earliest `createdAt` per market;
3. fetches each market's series once, with `Promise.allSettled` — a market that fails leaves its ideas unsettled and is logged, never thrown (spec: "Candles unavailable");
4. runs `settleSignal` on each and returns the ones that changed.

Alternative: one fetch per unsettled idea — rejected, N requests for the same market on every feed load.

### D4. Persist once, in the feed loader, without blocking the response
`repo.setOutcome(id, outcome)` runs `UPDATE signals SET outcome = ? WHERE id = ? AND outcome IS NULL`. The `AND outcome IS NULL` makes it idempotent under concurrency: two simultaneous feed loads cannot fight, and the first writer wins. `loadFeed` awaits `settleAll` and the writes before returning, so the response already carries the new outcomes — it is at most one extra round trip per market, and only while something is unsettled. Once everything is settled the pass costs one array filter.

Alternative: settle in a background task or a cron — rejected for this project: there is no scheduler on the free tier, and a demo that only settles "eventually" is worse than one that settles when someone looks.

### D5. `AuthorStats` gains counts, not a rate
`{ author, ideas, copies, settled, won }`. The interface computes "1 of 2 hit"; the API does not send a percentage. Reasons: a rate over one idea is noise, and the UI can decide to hide it (it does, when `settled === 0`). SQL:

```sql
SELECT s.author AS author,
       count(DISTINCT s.id) AS ideas,
       count(c.id) AS copies,
       count(DISTINCT CASE WHEN s.outcome IS NOT NULL THEN s.id END) AS settled,
       count(DISTINCT CASE WHEN s.outcome = 'tp' THEN s.id END) AS won
FROM signals s LEFT JOIN signal_copies c ON c.signal_id = s.id
GROUP BY s.author ORDER BY copies DESC, ideas DESC, author ASC
```

`count(DISTINCT … CASE …)` and not `sum(...)` because the `LEFT JOIN` multiplies a signal's row by its copies.

### D6. The outcome replaces the "live/expired" label, and closes the idea
`SignalCard` and `SignalDetail` show a badge from one helper, `outcomeLabel(signal)`: `tp` → "hit take profit ✅" in `text-up`, `sl` → "hit stop loss ❌" in `text-down`, `expired` → "expired ⏱" in `text-muted`, none → today's "live · 3h left". The card's action already switches to the secondary "See how it went" for expired ideas; the condition becomes "settled" instead of "expired by the clock". `CopyPanel` disables on any outcome, and the copy route's existing `isExpired` check becomes an outcome check as well, so a settled-early idea cannot be copied through the API either.

Colour: no new tokens. `up`/`down` are already reserved for direction and profit; an outcome is exactly that.

## Risks / Trade-offs

- [A feed load with many unsettled ideas across many markets] → one request per *market*, in parallel, and only for unsettled ideas; in the demo that is one or two. If it ever grew, the next step is a cap per pass, not a rewrite.
- [The exchange returns fewer candles than the window asks for] → `settleSignal` judges what it receives; missing history simply leaves the idea open until it expires, which is the honest outcome.
- [An idea marked `sl` that a human would call `tp`] → only possible inside a single candle, documented in the README and chosen deliberately.
- [Settlement writes on a read request] → an `UPDATE … WHERE outcome IS NULL` is idempotent and cheap; the alternative (a scheduler) does not exist on this hosting.

## Migration Plan

No schema change: the `outcome` column and its `CHECK` already exist. Existing ideas are settled on the first feed load after deploy, in the same pass. Rollback is reverting the commit; the column simply stops being written.

## Open Questions

None.
