## Context

Available: the trading boundary (`placeMarketOrder` with optional `tpPrice`/`slPrice`, `getPrice`, `listMarkets`), `apiHandler`, `usePoll`/`postEnvelope`, the shell components (Sheet, Toast, BigButton, Card) and the Trade screen patterns. Explore findings for this change: `better-sqlite3` has no prebuilt binary for Node 24 on this machine and `node-gyp` fails (no Python); Node 24's built-in `node:sqlite` (`DatabaseSync`, SQLite 3.53) works under tsx and plain Node with a synchronous API. `lightweight-charts` is 5.2.1 (v5 API). `read.candlesticks.getByName({ marketName, interval: "1m", startTime, endTime })` returns ~200 candles in < 1 s, `t` in ms ascending, fields `o/h/l/c/v`. See proposal.md for scope and the `copy-trade-signals` delta spec for behavior.

## Goals / Non-Goals

**Goals:**
- Copies reuse the exact same order path as the trade screen; no second way to reach the exchange.
- Entry price is a server fact, never client input.
- Zero native dependencies for persistence; a reviewer clones and runs.

**Non-Goals:**
- Outcome detection, profiles, leaderboard, WebSocket, auth (later changes).

## Decisions

### D1. Persistence with `node:sqlite`
`lib/signals/db.ts` opens `DatabaseSync(env.DB_PATH)` lazily (mkdir of the parent), runs `CREATE TABLE IF NOT EXISTS` for `signals` and `signal_copies`, enables `PRAGMA journal_mode = WAL` and `foreign_keys = ON`. One connection per process (module singleton). Alternatives: `better-sqlite3` — rejected, no prebuilt binary for Node 24 here and a native build step for the reviewer; `@libsql/client` — works but adds a dependency for no gain; JSON file — no transactions/indexes. `node:sqlite` is stable in Node 24 (`engines.node >= 22` already declared; the README states Node 24).

```
signals(id TEXT PK, author TEXT, market TEXT, side TEXT, entry_price REAL, tp_pct REAL, sl_pct REAL,
        tp_price REAL, sl_price REAL, hold_hours REAL, size REAL, note TEXT NULL,
        created_at INTEGER, expires_at INTEGER, outcome TEXT NULL)
signal_copies(id TEXT PK, signal_id TEXT FK, copier TEXT, size REAL, fill_price REAL, tx_hash TEXT, created_at INTEGER)
index signals(created_at DESC), signal_copies(signal_id)
```
Ids are `crypto.randomUUID()`. Rows are parsed with zod (`SignalRow`, `CopyRow`) before leaving `repo.ts`, so a schema drift is a loud error, not `undefined` in the UI.

### D2. Repository API (`lib/signals/repo.ts`)
`createSignal(input & { entryPrice, tpPrice, slPrice, createdAt, expiresAt })`, `listSignals()` (newest first, `copyCount` via subquery), `getSignal(id)` (with copies), `addCopy(signalId, { copier, size, fillPrice, txHash })`, `authorStats()` (ideas and copies per author). All synchronous; injectable database for tests (`createRepo(db)`), tests run against `:memory:`.

### D3. Signal math (`lib/signals/math.ts`, pure, tested)
`tpSlPrices(side, entry, tpPct, slPct)`: up → `tp = entry × (1 + tpPct/100)`, `sl = entry × (1 − slPct/100)`; down → mirrored. `isExpired(signal, now)`. `describe(signal)` builds the plain-language sentence used on cards and the detail.

### D4. Schemas
```ts
SignalInput = z.object({ author: z.string().trim().min(1).max(40), market: z.string().min(1), side: OrderSide,
  tpPct: z.coerce.number().gt(0).lt(100), slPct: z.coerce.number().gt(0).lt(100),
  holdHours: z.coerce.number().min(1).max(720), size: sizeField, note: z.string().trim().max(140).optional() }).strict();
CopyInput = z.object({ copier: z.string().trim().min(1).max(40), size: sizeField.optional() }).strict();
```
`sizeField` is the same loose number field as `OrderInput` (range judged by `toValidOrderSize`). Percentages are validated in zod because the range is fixed and the message is simple; size stays with the domain.

### D5. Routes
- `POST /api/signals`: `getPrice(market)` → `tpSlPrices` → `toValidOrderSize` (via a small `assertTradableSize` helper so the message matches the trade screen) → `createSignal`. Returns the signal with `copyCount: 0`.
- `GET /api/signals`: `listSignals()` + `authorStats()`; `expired` computed with `isExpired`.
- `GET /api/signals/[id]`: `getSignal` (404 `NOT_FOUND` when missing — `apiHandler` gains a `NotFoundError` → 404 mapping), `getPrice`, `read.candlesticks.getByName` for the last 200 minutes via a `getCandles(market, minutes)` helper in `lib/decibel/markets.ts`. Candle fetch failures degrade to an empty array with `candlesError` so the page still renders the lines.
- `POST /api/signals/[id]/copy`: `getSignal` → `isExpired` → size default → `placeMarketOrder({ marketName, isBuy, size, tpPrice, slPrice })` → `addCopy` in try/catch (log + still return success) → receipt + `copyCount`.

### D6. TP/SL attached to copies
`placeMarketOrder` already converts `tpPrice`/`slPrice` to tick-rounded trigger prices and asserts their sides against the live mid. If the exchange rejects trigger prices on IOC orders (to be verified in task 3.2), the copy route falls back to placing the order without them and marks the receipt `tpSlAttached: false`; the UI says so. No silent success either way.

### D7. Chart (`components/PriceChart.tsx`)
Client-only via `next/dynamic(..., { ssr: false })`. `createChart` with dark options from the tokens; `chart.addSeries(CandlestickSeries, { upColor: up, downColor: down, … })`; `series.setData(candles.map(c => ({ time: c.t / 1000, open: c.o, high: c.h, low: c.l, close: c.c })))` (v5 wants seconds); `createPriceLine` ×3 with titles "Entry", "Take profit", "Stop loss"; `createSeriesMarkers(series, copies.map(...))` for copy markers; `fitContent()`; `ResizeObserver` for width. Alternative: SVG by hand — rejected (looks homemade, SHOULD 6 is the most visible feature).

### D8. Screens
- `app/page.tsx` (server): reads `listSignals` + stats directly (no HTTP hop) and renders `Feed` (client) with the cards and the `PostIdeaSheet`. After posting, the feed re-fetches `GET /api/signals` (client) so the new card appears without a full reload.
- `components/SignalCard.tsx`: initial in a yellow circle, "went Up on BTC · 12m ago", pills "TP +3 %" / "SL −2 %", "copied 3×", "live · 3h left" or "expired", yellow Copy → `/signals/[id]`.
- `components/PostIdeaSheet.tsx`: form state; live price via `usePoll(/api/price/...)`; previews with `tpSlPrices`; `postEnvelope("/api/signals")`; toasts.
- `app/signals/[id]/page.tsx` (server) → `SignalDetail` (client): `usePoll(/api/signals/[id], 10000)`, `PriceChart`, sentence from `describe`, `CopyPanel` (size input default author's, yellow "Copy this trade", double-submit guard, toast with explorer link, then `refresh()`).

## Risks / Trade-offs

- [`node:sqlite` inside a Next Route Handler] → builtins are externalized by Turbopack; verified in task 1.1 with a route that inserts and reads a row.
- [Trigger prices rejected on IOC orders] → D6 fallback with an honest flag.
- [Thin book: copy order sent but not filled] → receipt says "sent"; the copy is recorded with the reference price, and the account card shows whether a position appeared.
- [Author/copier are free-text names on one key] → documented in README and on the sheet ("play names, same testnet account").
- [Chart bundle size] → dynamic import, only on the detail page.

## Migration Plan

New tables created on first use; no migration. Deleting `data/signals.db` resets the history.

## Open Questions

None blocking. Whether copies should also be listed on the copier's Trade screen is a later polish question.
