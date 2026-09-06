## Why

The MUST tier is done: anyone can trade from the app. The differentiator the brief asks for is **copy-trade**: an author posts a trade idea ("Up on BTC, take profit +3 %, stop loss −2 %, hold 4 h"), everyone sees it on a chart, and one tap submits the same trade from their own account with the builder code attached. Every idea is kept as a running history so an author's track record can be judged.

**Tier served:** SHOULD 5 (signal authoring), 6 (chart with entry/TP/SL), 7 (one-click copy), 8 (persisted history / track record).

## What Changes

- **Persist signals** in a local SQLite file at `DB_PATH` using Node's built-in `node:sqlite` (no native build, no new dependency): tables `signals` and `signal_copies`, created on first use.
- **Signal contract** in `lib/schemas.ts`: `SignalInput` (author name, market, side up/down, TP %, SL %, hold hours, size, optional note) and `CopyInput` (copier name, optional size), both `.strict()`; response types `Signal`, `SignalCopy`, `SignalDetail`, `Candle`, `AuthorStats`.
- **Routes**: `GET /api/signals` (newest first, with copy counts and author stats), `POST /api/signals` (entry price read server-side from the live mid; TP/SL prices computed and their sides asserted), `GET /api/signals/[id]` (signal, copies, live price, last 200 one-minute candles), `POST /api/signals/[id]/copy` (rejects expired ideas; size defaults to the author's; places the order through `placeMarketOrder` with the signal's TP/SL attached; records the copy).
- **Feed** on `/` replacing the placeholder home: signal cards ("went Up on BTC · 12 m ago", TP/SL pills, "copied 3×", author summary), a "Post an idea" bottom sheet with the live entry price read-only and TP/SL previews in dollars.
- **Signal detail** at `/signals/[id]`: candlestick chart (`lightweight-charts` 5) with Entry (yellow), Take profit (green), Stop loss (red) lines and markers at copy times; a plain-language sentence; a size field defaulting to the author's; the yellow "Copy this trade" button with pending/success/error states.
- `README.md`: SHOULD 5–8 ✅, demo path extended (post → open → copy), checklist rows.

## Capabilities

### New Capabilities
- `copy-trade-signals`: authoring, persisting, listing and visualizing trade ideas, and copying one with a single tap into the copier's own testnet account.

### Modified Capabilities
- (none) — `trading` is consumed unchanged: copies go through the same `placeMarketOrder` boundary.

## Non-goals

- No profile switcher, trader profile page or leaderboard (next changes: `profile-switcher`, STRETCH `leaderboard`).
- No outcome marking (hit TP / SL / expired) — STRETCH `signal-outcomes`.
- No WebSocket; polling only. No authentication: author and copier are display names on the same testnet key (documented).
- No remote database; the SQLite file is local and gitignored.

## Impact

- New files: `lib/signals/{db,repo,math}.ts` (+ tests), `lib/schemas.ts` additions, `app/api/signals/**`, `app/page.tsx` (feed), `app/signals/[id]/page.tsx`, `components/{SignalCard,PostIdeaSheet,PriceChart,CopyPanel}.tsx`.
- New runtime dependency: `lightweight-charts` (client only, ~45 KB). `node:sqlite` is built into Node ≥ 22.5; `engines.node` stays `>=22`.
- `data/signals.db` created at runtime (gitignored).
