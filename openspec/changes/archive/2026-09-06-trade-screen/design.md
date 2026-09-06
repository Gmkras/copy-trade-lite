## Context

Available: the app shell (tokens, BigButton, Card, Sheet, Toast, BottomNav), `lib/env`, and the server-only Decibel layer (`getDecibel`, `placeMarketOrder`, units, `TradeError`). Verified in the explore spike for this change: a Route Handler importing `@/lib/decibel` builds under Turbopack (the SDK's extensionless ESM imports are resolved by the bundler) and returns live data; folders starting with `_` under `app/` are not routable. Real BTC/USD testnet precision: min 0.00002, tick $1, lot 0.00001. See proposal.md for motivation and the `trading` delta spec for behavior.

## Goals / Non-Goals

**Goals:**
- One validated boundary for anything that can reach `placeOrder` (constitution E4, S4).
- A screen a 12-year-old can use: three choices and one button; every number with context.
- Honest liveness: polling with visible staleness, no fake real-time.

**Non-Goals:**
- WebSocket, signals, chart, persistence, authentication (later changes / documented risk).

## Decisions

### D1. Module layout
```
lib/schemas.ts          zod: OrderInput (.strict()), ApiEnvelope types, shared response types (Market, Price, AccountState, OrderReceipt)
lib/api.ts              apiHandler(fn): parses JSON + schema, maps errors → HTTP; server-only
lib/format.ts           money(), amount(), pct(), timeAgo() — client-safe, no secrets
lib/decibel/account.ts  getAccountState(): concurrent reads + PnL enrichment (server-only via index)
app/api/markets/route.ts, app/api/price/[market]/route.ts, app/api/account/route.ts, app/api/order/route.ts
hooks/usePoll.ts        usePoll<T>(url, ms): { data, error, stale, refresh }
components/CoinPills.tsx, SideToggle.tsx, SizePicker.tsx, TradeForm.tsx (client), AccountCard.tsx (client)
app/trade/page.tsx      server component composing TradeForm + AccountCard
```
`lib/api.ts` and `lib/decibel/account.ts` import through `@/lib/decibel` (server-only gate). Client components only import `lib/schemas.ts` (types + OrderInput for client-side hints) and `lib/format.ts`, both free of secrets and Node APIs.

### D2. Request schema and envelope
```ts
OrderInput = z.object({
  market: z.string().min(1),
  side: z.enum(["up", "down"]),
  size: z.coerce.number().finite().positive(),
}).strict();
```
`side: "up" | "down"` is the product vocabulary; the server maps it to `isBuy`. The size cap and market minimum are enforced by `toValidOrderSize` inside `placeMarketOrder` (single source of truth); the schema only guarantees a positive finite number so the range message comes from one place.

*Implementation note (task 1.1):* the schema is looser than written above — `size: z.union([z.number(), z.string().min(1)]).transform(Number)` — so that `"abc"`, `0` and out-of-range values all reach `toValidOrderSize` and get **the same message with the allowed range** ("Size must be a number between 0.00002 and 0.01 BTC"), as the `trading` spec requires. Checking `finite().positive()` in zod would have produced a second, range-less message for the same mistake. `.strict()` still rejects any unknown field before the domain is touched. The previous wording is kept in `design.md.old`. Envelope: `{ ok: true, data: T } | { ok: false, code: string, message: string }`. `apiHandler` maps: `ZodError` → 422 `INVALID_INPUT` with the first issue's path + message; `TradeError` → 422 with its `code`; anything else → 502 `UPSTREAM` "Could not reach the exchange. Try again in a moment." and `console.error` with the cause. Alternative: 400 for validation — 422 chosen to distinguish "well-formed but invalid" from malformed JSON (400).

### D3. Account state
`getAccountState()` runs `Promise.all` over overview, positions, open orders, trade history (limit 20) and `marketPrices.getAll()`; a 404 (`isNotFoundError`) on the account reads yields the empty state. Per position: `side = size > 0 ? "up" : "down"`, `markPrice` from the prices map, `pnlUsd = (mark − entry) × size` (size signed), `pnlPct = pnlUsd / (entry × |size|)`. Overview `unrealized_pnl` is used for the headline PnL; `usdc_cross_withdrawable_balance` for "Available". Alternative: N routes — rejected; one call keeps the polling cheap and consistent.

### D4. Polling hook
`usePoll(url, intervalMs)`: `useEffect` with `setInterval`, `AbortController` per request, `stale: true` when the last fetch failed after a success, `refresh()` to trigger immediately (used after an order). Keeps the last good `data`. Alternative: TanStack Query — rejected per plan (three queries, no library).

### D5. Trade form behavior
State: `market` (default BTC/USD), `side` (default up), `size` (default first chip). Chips are derived from the market: `[min, min×5, min×10]` formatted; the free input shows `min` as placeholder. Client-side hint only mirrors the range (min and `MAX_ORDER_SIZE` from `/api/markets`, which returns the cap); the server remains the authority. Button label: `${side === "up" ? "Buy" : "Sell"} ${amount(size)} ${symbol} ≈ $${money(size × mid)}`. Submit: `pending` guard (state + ref) prevents double submit; on success `toast.show("Order sent", { variant: "success", link })` and `refresh()` the account; on `ok:false` `toast.show(message, { variant: "error" })`. No jargon anywhere; price line "1 BTC = $79,990".

### D6. Account card
Three `font-display` numbers; PnL colored `text-up`/`text-down`. Sections collapsed by default except Positions. Rows are cards, not tables. Empty states: "No trades yet — try Up on BTC", "No open orders", "No fills yet". Chip "couldn't refresh" when `stale`.

### D6b. Only tradable markets are listed (found in the P-R review)
`MAX_ORDER_SIZE` is one cap in base units, so a market whose minimum order is above it (ADA min 5, WLFI min 10, …) can never be traded here and the form would show an impossible range ("Between 5 and 0.01 ADA"). `listMarkets()` therefore returns only open perps with `minSize <= maxOrderSize`. Honest and simple; a per-market cap is a later refinement. Previous wording kept in `design.md.old2`.

### D7. Explorer URL
`https://explorer.aptoslabs.com/txn/<hash>?network=testnet` built server-side in the order route (single place).

## Risks / Trade-offs

- [Route handlers compile the SDK on first hit (~6–8 s in dev)] → acceptable; production build precompiles. The account poll starts after mount, so the first paint is instant.
- [Rate limits from Geomi with 5 s polling] → one `/api/account` call per tick (5 upstream reads); raise to 8 s if 429s appear.
- [Thin book: IOC may not fill] → the UI says "Order sent" with the link, and the card shows whether a position appeared; no claim of a fill.
- [Public POST route with the server key] → localhost only; README warning; size cap and fee bound remain enforced server-side.

## Migration Plan

Replaces the `/trade` placeholder page. No data migration.

## Open Questions

None blocking. Whether to show the free input's dollar value for sizes below the minimum is a polish detail for T12.
