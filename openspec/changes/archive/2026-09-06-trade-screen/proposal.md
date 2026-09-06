## Why

MUST 1–2 are proven by scripts; a reviewer now needs to place a trade and watch the account **from the app**. This change exposes the connection layer through validated API routes and builds the one screen the brief describes: pick a coin, Up or Down, how much, one big button — plus the account, live-ish.

**Tier served:** MUST 3 (kid-friendly trade screen) and MUST 4 (live account: equity, positions with PnL, open orders). It completes the MUST tier.

## What Changes

- Add a shared **request/response contract** in `lib/schemas.ts` (zod, `.strict()`): `OrderInput` (`market`, `side: "up" | "down"`, `size` finite > 0 ≤ `MAX_ORDER_SIZE`) and the `ApiEnvelope` `{ ok: true, data } | { ok: false, code, message }`. No request schema has a fee field.
- Add `lib/api.ts` with `apiHandler()`: parses with zod, maps zod errors → 422, `TradeError` → 422 with its code, unknown → 502 with a safe message and a server log. Every route runs with `runtime = "nodejs"`.
- Add **read routes**: `GET /api/markets` (open perp markets with precision, BTC first), `GET /api/price/[market]` (mid/mark), `GET /api/account` (equity, withdrawable, unrealized PnL, positions enriched with mark price and per-position PnL, open orders, last 20 fills; 404-before-first-deposit reported as an empty account).
- Add **`POST /api/order`**: validated body → `placeMarketOrder` → `{ transactionHash, explorerUrl, referencePrice, limitPrice, size, orderId }`.
- Build **`/trade`** mobile-first: coin pills, two huge Up/Down buttons, size chips + input with the market minimum as hint, live line "1 BTC = $…", the single yellow button reading "Buy 0.00002 BTC ≈ $1.60" with pending state, success toast with the explorer link, plain-language errors. Below it an **Account card**: three big numbers (Equity, Available, PnL) and collapsible Positions / Orders / Fills, polling `/api/account` every 5 s through a small `usePoll` hook that keeps the last good data and shows a "couldn't refresh" chip on failure.
- Update `README.md` (MUST 3–4 ✅, demo path from the UI) and add the trade screen to the manual checklist.

## Capabilities

### New Capabilities
- `trading`: the HTTP contract (markets, price, account, order) and the Trade screen that lets a non-trader place a real testnet order and watch the account.

### Modified Capabilities
- (none) — `app-shell` and `decibel-connection` are consumed unchanged.

## Non-goals

- No signals, no chart, no persistence (next change: `copy-trade-signals`).
- No WebSocket; polling only (STRETCH later).
- No authentication on the routes; the app stays on localhost (documented risk).
- No markets other than perps; BTC/USD is the default, other open perps are selectable but not tuned.

## Impact

- New files: `lib/schemas.ts`, `lib/api.ts`, `app/api/{markets,price/[market],account,order}/route.ts`, `hooks/usePoll.ts`, `components/{CoinPills,SideToggle,SizePicker,AccountCard,TradeForm}.tsx`, `app/trade/page.tsx` (replaces the placeholder), `lib/format.ts`.
- Reuses `@/lib/decibel` (server-only gate) — verified in an explore spike that Turbopack bundles the SDK inside a Route Handler and returns live data.
- New dev dependency: none. Runtime dependencies unchanged.
