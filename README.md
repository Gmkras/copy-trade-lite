# Copy-Trade Lite

A dead-simple trading app on **Decibel (Aptos testnet)** that a smart 12-year-old could use, with a copy-trade signal feature on top. Built 100% in TypeScript with Next.js. **Testnet only, play money only.**

> **Status:** work in progress, built change by change with Spec-Driven Development (OpenSpec). The table in [What works today](#what-works-today) is kept honest at every commit.

## What works today

| Tier | Feature | Status |
|---|---|---|
| — | App shell: validated env + testnet guard, design tokens, base components, two-tab navigation | ✅ Done (`bootstrap-app`) |
| MUST 1 | Connect to Decibel on Aptos testnet and authenticate the account | ✅ Done (`decibel-testnet-connection`) — `pnpm smoke` |
| MUST 2 | Real testnet order with builder codes (approve → place), fee bound enforced | ✅ Done (`decibel-testnet-connection`) — `pnpm approve`, `pnpm order:once` |
| MUST 3 | Kid-friendly trade screen: coin, Up/Down, how much, one button | ✅ Done (`trade-screen`) — `/trade` |
| MUST 4 | Live account: equity, positions + PnL, open orders, fills (5 s polling, honest staleness) | ✅ Done (`trade-screen`) — `/trade` |
| SHOULD 5 | Signal authoring: entry = live price, TP %, SL %, hold duration | ✅ Done (`copy-trade-signals`) — "Post an idea" on `/` |
| SHOULD 6 | Signal on a chart with entry / take-profit / stop-loss lines | ✅ Done (`copy-trade-signals`) — `/signals/[id]` |
| SHOULD 7 | One-click copy from the copier's own account, builder code attached | ✅ Done (`copy-trade-signals`) — "Copy this trade" |
| SHOULD 8 | Persisted signal history with per-author track record | ✅ Done (`copy-trade-signals`) — SQLite at `DB_PATH` |
| STRETCH | WebSocket, outcome marking (hit TP/SL), leaderboard | ⏳ Not done — see [What's next](#whats-next) |

Proof on the Aptos testnet explorer: first order from the script `0x5f433998292cf8350bbbb92e52fd334c70e4c92c98132b90caf6f73291f86875`, builder-fee approval `0x0c237551c7a68fad58c6999cc0f883fc78bce6d947cf845f384d34fa5e198f24`, order placed from the Trade screen `0x9e3276151dae78bb1a41e9dd7ae16148a42f90e9bb467df165dd43e51b9cf7af`, **signal copied with one tap** `0x54c0e82a700bec0d4372b0ed6a589c10732f988b5bb306e02abac5acc924dff3`.

> **Play names, one account.** Authors and copiers are display names typed in the form; every order is signed with the single testnet key in `.env`. There is no login — that is out of scope for this take-home and is called out under [Safety](#safety).

## Prerequisites

- **Node.js 22+** (built on 24) and **pnpm 12** (`npm i -g pnpm`)
- **Git**
- Testnet credentials (below). No mainnet config exists anywhere in this repo.

## Get your credentials (≈10 minutes)

You need three values. Everything else in `.env` has safe defaults.

1. **`PRIVATE_KEY`** — the Ed25519 private key of a **testnet** wallet.
   [app.decibel.trade/api](https://app.decibel.trade/api) → *API Wallet* → copy the private key. Or generate a fresh one with `pnpm keygen` (prints the key once, writes nothing to disk).
2. **`APTOS_NODE_API_KEY`** — a Geomi API key (Aptos Labs infrastructure). Without it every SDK call returns `401`.
   [geomi.dev](https://geomi.dev) → *New Project* (any name) → *API Keys* → *Create New API Key* → **Network: Testnet**, **Client usage: OFF** (the key stays on the server).
3. **`BUILDER_ADDRESS`** — the Decibel **trading subaccount** that receives builder fees. It must be a subaccount, not a plain wallet (the chain aborts with `EBUILDER_SUBACCOUNT_NOT_FOUND` otherwise). The simplest choice is your own primary subaccount, which `pnpm smoke` prints — see step 3 of [Run it locally](#run-it-locally).

Then get testnet **APT for gas**: [aptos.dev/network/faucet](https://aptos.dev/network/faucet) (sign in, Testnet, paste your wallet address, Request). Check it arrived on the explorer: `https://explorer.aptoslabs.com/account/<your-wallet>?network=testnet`.

## Run it locally

```bash
git clone <this repo> copy-trade-lite
cd copy-trade-lite
pnpm install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
```

1. Open `.env`, fill in `PRIVATE_KEY` and `APTOS_NODE_API_KEY`, and put your **wallet address** in `BUILDER_ADDRESS` for now (any valid hex works to get started). Leave the rest as is:

   ```
   BUILDER_FEE_BPS=10          # protocol cap; also the per-order fee
   DECIBEL_NETWORK=testnet     # anything else refuses to start
   MAX_ORDER_SIZE=0.01         # fat-finger cap in base units (BTC)
   DB_PATH=./data/signals.db   # SQLite file, created on first use
   ```

2. Prove the connection (no transactions):

   ```bash
   pnpm smoke
   ```
   Expected (values will differ):
   ```
   wallet      0xdc47…86cc
   subaccount  0x2cec…dd1e
   builder     0xdc47…86cc  fee 10 bps  max order 0.01
               ⚠ BUILDER_ADDRESS is your wallet; the chain expects a Decibel subaccount. Use the subaccount line above.
   gas         10.0000 APT
   markets     67 open perp markets
     BTC/USD    min 0.00002  tick 1  lot 0.00001  decimals px=6 sz=9
   BTC/USD     mid $79,990.00  mark $79,990.00  oracle $79,989.45
   equity      $0.00  (trading account not created yet — run `pnpm mint` to deposit play money)
   ✓ connection OK
   ```

3. Copy the `subaccount` line into `BUILDER_ADDRESS` in `.env` (the warning disappears on the next `pnpm smoke`).

4. Get play money — mints test USDC through Decibel's testnet faucet function and deposits it into your trading subaccount (2 transactions, needs APT for gas):

   ```bash
   pnpm mint            # default 1000 USDC; the testnet allowance is 1000 per wallet per day
   ```
   ```
   mint allowance  1,000.00 USDC available for this wallet
   minted          1,000.00 USDC  https://explorer.aptoslabs.com/txn/0x…?network=testnet
   deposited       1,000.00 USDC  https://explorer.aptoslabs.com/txn/0x…?network=testnet
   equity now      $1,000.00  (withdrawable $1,000.00)
   ✓ play money ready
   ```

5. Approve the builder fee (step 1 of builder codes; safe to re-run). A fresh clone always needs this, even if the wallet approved before: the approval lives on chain, but the local record the app checks before signing is in `data/`, which is not in version control. Skipping it stops the next step with "The builder fee has not been approved yet. Run `pnpm approve` once before trading."

   ```bash
   pnpm approve
   ```
   ```
   approved          10 bps for 0x2cec…dd1e
   transaction       https://explorer.aptoslabs.com/txn/0x…?network=testnet
   recorded in       data/builder-approval.json
   ✓ builder fee approved
   ```

6. Place one real order — the minimum BTC/USD size (0.00002 BTC ≈ $1.6), immediate-or-cancel, builder code attached:

   ```bash
   pnpm order:once            # add --sell to go the other way, or a size like 0.00005
   ```
   ```
   Buying 0.00002 BTC on BTC/USD (IOC, builder fee 10 bps)…
   transaction   0x5f43…6875
   explorer      https://explorer.aptoslabs.com/txn/0x5f43…6875?network=testnet
   reference     $79,954.00   limit $80,354.00
   order id      1701…9696
   ✓ order transaction committed
   ```
   Run `pnpm smoke` again: `positions 1` and the fee deducted from *withdrawable*.

7. Start the app and trade from the screen:

   ```bash
   pnpm dev          # http://localhost:3000
   ```

   **Demo path (what a reviewer does first, ~90 seconds).** Use a phone-sized viewport (DevTools → device toolbar → 375 px):

   1. **Trade** tab → BTC is selected → tap **Up ↑** → tap the **0.00002** chip. The yellow button reads "Buy 0.00002 BTC ≈ $1.60".
   2. Tap it once → "Sending your order…" → green toast **See it on the explorer** (testnet transaction, status Success) → scroll to **Your account**: Equity, Available, PnL and the position with PnL in $ and %.
   3. **Feed** tab → **Post an idea**: your name, BTC, **Up**, take profit 3 %, stop loss 2 %, hold 4 hours. The entry is the live price, read on the server; the dollar previews follow what you type. Tap **Post this idea**.
   4. The new card is first in the feed: "went Up on BTC · just now · live · 4h left · copied 0×". Tap the yellow **Copy**.
   5. The idea on a chart: candles with **Entry** (yellow), **Take profit** (green) and **Stop loss** (red) lines. Type a different name and tap **Copy this trade** once → toast with the explorer link → a marker appears on the chart and the count becomes "Copied 1×".
   6. Back on **Feed**, the card says "copied 1×" and the author line shows "1 idea · 1 copy". On **Trade**, the position grew.

   The first request after `pnpm dev` compiles the routes and can take ~8 s; after that the price and account refresh every 5 s and the feed every 10 s.

> **Security note — localhost only.** The private key lives on the server side of this app and the write routes (coming in later changes) have no authentication. Do not expose the dev server to the internet. See [Safety](#safety).

## Manual test checklist (current state)

**Connection and orders (scripts):**

| Command | Expect |
|---|---|
| `pnpm smoke` with a wrong `APTOS_NODE_API_KEY` | exit 1: `Your Geomi API key was rejected. Create a Testnet key at https://geomi.dev …`, no stack trace, no secret printed |
| `pnpm mint 999999` | exit 1 **before any transaction**: allowance message with the reset time |
| `pnpm order:once 0` / `pnpm order:once 5` / `pnpm order:once abc` | exit 1, no transaction: `… choose an amount between 0.00002 and 0.01 BTC` |
| Approve 5 bps then order with 10 bps: `BUILDER_FEE_BPS=5 pnpm approve` (PowerShell: `$env:BUILDER_FEE_BPS=5; pnpm approve`), then `pnpm order:once` | exit 1, no transaction: `Builder fee 10 bps exceeds the approved maximum of 5 bps …`. Restore with `pnpm approve`. |
| `pnpm approve` twice | both succeed; second run shows "already approved" and re-approves |

**Environment guard** (the app and every script must refuse to start on a bad config):

| Change in `.env` | Expect |
|---|---|
| `DECIBEL_NETWORK=mainnet` | `DECIBEL_NETWORK must be exactly "testnet" — mainnet is never allowed` |
| `BUILDER_FEE_BPS=11` | `BUILDER_FEE_BPS must be between 0 and 10 basis points (protocol cap)` |
| `PRIVATE_KEY=` (empty) | `PRIVATE_KEY is required …`; no secret value is printed |

**Trade screen** (`pnpm dev`, phone-sized viewport, 375 px, <http://localhost:3000/trade>):

- [ ] Default: BTC selected, Up selected, first chip selected, "1 BTC = $…" shows a price, yellow button enabled with size and ≈ dollar value. No trading jargon anywhere.
- [ ] Tap **Down ↓** and the third chip → button reads "Sell 0.0002 BTC ≈ $…"; nothing is sent until you tap it.
- [ ] Type `0` or `5` in the box → button disabled, red hint "Choose an amount between 0.00002 and 0.01 BTC".
- [ ] Tap the yellow button once → "Sending your order…", then a green toast with **See it on the explorer** (opens a successful testnet transaction); within 10 s the position in **Your account** updates.
- [ ] Tap the yellow button twice quickly → only one order is sent (the button is disabled while sending).
- [ ] Turn off Wi-Fi (or block `/api/account` in DevTools) → the account numbers stay and a "couldn't refresh" chip appears; turn it back on → the chip disappears.
- [ ] Empty account (fresh key, no mint): the card shows $0.00 and "No trades yet — try Up on BTC"; placing an order shows the plain-language "Not enough play money — run `pnpm mint`" toast.

**Ideas, chart and copy** (`/` and `/signals/[id]`, 375 px):

- [ ] Empty database → the feed says "No ideas yet — post the first one" with the Post an idea action visible.
- [ ] In **Post an idea**, change take profit from 3 to 5 → the "out at $…" preview updates without submitting. Entry is read-only.
- [ ] Enter take profit `0` and post → error toast "Take profit must be more than 0%", the sheet stays open with your inputs.
- [ ] Post a valid idea → toast, sheet closes, card first in the feed with "live · Xh left".
- [ ] Open the card → chart with three labeled lines at the entry, take-profit and stop-loss prices, plus the plain-language sentence.
- [ ] Tap **Copy this trade** once → busy label → toast with an explorer link → marker on the chart, "Copied 1×", copier listed.
- [ ] Tap it twice quickly → only one order is placed.
- [ ] Restart `pnpm dev` → the ideas and copies are still there (SQLite at `DB_PATH`).
- [ ] An expired idea shows "expired" on the card and a disabled "This idea has expired" button on its detail.

**API contract** (with the dev server running):

| Request | Expect |
|---|---|
| `curl localhost:3000/api/markets` | `ok:true`, BTC/USD first with `minSize 0.00002`; only markets whose minimum fits under `MAX_ORDER_SIZE` are listed |
| `curl localhost:3000/api/price/FOO%2FUSD` | 422 `UNKNOWN_MARKET` |
| `curl -X POST localhost:3000/api/order -H "content-type: application/json" -d '{"market":"BTC/USD","side":"up","size":"abc"}'` | 422 `INVALID_SIZE` with the allowed range |
| … `-d '{"market":"BTC/USD","side":"up","size":0.00002,"builderFee":1}'` | 422 `INVALID_INPUT` "Unexpected field: builderFee." (same for `price`, `builderAddr`) |
| … `-d '{not json'` | 400 `BAD_JSON` |
| `curl -X POST localhost:3000/api/signals -H "content-type: application/json" -d '{"author":"Ana","market":"BTC/USD","side":"up","tpPct":3,"slPct":2,"holdHours":4,"size":0.00002}'` | 200 with `entryPrice` from the live mid and `tpPrice ≈ entry × 1.03` |
| … with `"entryPrice":1` added | 422 "Unexpected field: entryPrice." (the client can never set the entry) |
| … with `"tpPct":0` / `"holdHours":1000` | 422 with the plain-language range |
| `curl localhost:3000/api/signals/nope` | 404 `NOT_FOUND` |
| `curl -X POST localhost:3000/api/signals/<expired-id>/copy -d '{"copier":"Ben"}'` | 422 `SIGNAL_EXPIRED`, no order placed |

**Shell and navigation**:

- [ ] `/` shows the yellow headline in Space Grotesk on black; no other saturated color.
- [ ] Tap **Trade** → `/trade`, tab turns yellow; tap **Feed** → back.

**Quality gates:**

```bash
pnpm typecheck   # tsc --noEmit, strict
pnpm lint        # eslint
pnpm test        # vitest: chain units, order safety checks (33 tests, no network)
pnpm build       # production build; must succeed
```

**Server-only boundary (optional):** add `import { env } from "@/lib/env";` to `components/BottomNav.tsx` and run `pnpm build`. It must fail with `You're importing a module that depends on "server-only"`. Remove the line; the build passes again.

## Project structure

```
app/                    Next.js App Router: layout, feed (/), /trade, /signals/[id]
app/api/                markets, price/[market], account, order, signals, signals/[id], signals/[id]/copy — every route goes through apiHandler
components/             shell (BigButton, Card, Sheet, Toast, BottomNav), trading (CoinPills, SideToggle, SizePicker, TradeForm, AccountCard, TradeScreen), signals (Feed, SignalCard, PostIdeaSheet, SignalDetail, CopyPanel, PriceChart)
hooks/usePoll.ts        polling with last-good-data + stale flag (tests)
lib/signals/db.ts       node:sqlite database at DB_PATH, schema created on first use (no native deps)
lib/signals/repo.ts     prepared statements, zod-parsed rows, copy counts and author stats (tests)
lib/signals/math.ts     TP/SL prices, expiry, plain-language wording (tests)
lib/schemas.ts          zod OrderInput (.strict()) + shared response types (client-safe)
lib/api.ts              apiHandler: one envelope, 422/400 readable errors, safe 502 (tests)
lib/format.ts           money, amount, pct, timeAgo (client-safe)
lib/env.schema.ts       zod schema + loadEnv() (used by next.config.ts and scripts)
lib/env.ts              server-only frozen env for app code
lib/decibel/client.ts   SDK clients built once from env (TESTNET_CONFIG only), wallet/subaccount/builder
lib/decibel/units.ts    chain-unit math: tick/lot rounding, size bounds (tests)
lib/decibel/orders.ts   approveBuilderFee, placeMarketOrder with the fee bound asserted last (tests)
lib/decibel/account.ts  one-call account state with per-position PnL (tests)
lib/decibel/markets.ts  tradable markets (human units) and live price
lib/decibel/errors.ts   TradeError + plain-language mapping of SDK/chain errors
lib/decibel/index.ts    server-only gate: the only import path for app code
scripts/                keygen, smoke, mint-usdc, approve-builder, order-once (tsx)
specs/constitution.md   Non-negotiable rules with executable checks
openspec/               SDD artifacts: config, active changes, archive (process evidence; *.old = previous versions)
data/                   gitignored: builder-approval.json, signals.db
```

## Safety

Graded explicitly by the brief; enforced in code, not by convention:

- **Testnet only** — `TESTNET_CONFIG` is the only Decibel config imported (`lib/decibel/client.ts`); `DECIBEL_NETWORK` must equal `testnet` or the process exits (`lib/env.schema.ts`, run from `next.config.ts` and every script).
- **No secrets in the repo** — `.env*` and `data/` are gitignored since the first commit; `.env.example` has no real values; scripts never print keys.
- **Secrets never reach the browser** — `lib/env.ts` and `lib/decibel/index.ts` import `server-only`; a client component importing them breaks the build (verified).
- **Builder fee bound** — the fee is a server constant (`BUILDER_FEE_BPS`, validated `0..10` at startup); no function takes a fee parameter; `assertFeeBound` checks `fee ≤ approved max ≤ 10` immediately before the transaction is built, against the approval recorded by `pnpm approve`.
- **Validate before signing** — `toValidOrderSize` (finite, > 0, ≥ market minimum, ≤ `MAX_ORDER_SIZE`) and `assertTpSlSides` run before any pricing or signing; every rejection is a plain-language message with the allowed range.
- **One validated boundary** — `POST /api/order` and `POST /api/signals/[id]/copy` are the only ways an order enters; both bodies are `.strict()` zod schemas (coin, direction, size, names — nothing else) and both call the same `placeMarketOrder`. A copy cannot choose the price, the builder address, the fee or the exit levels: they come from the stored signal and the server constants. Errors never expose stacks, URLs or keys (`lib/api.ts`, tested).
- **The entry price is a server fact** — `POST /api/signals` reads the live mid itself; `SignalInput` has no `entryPrice` field and `.strict()` rejects one (tested).
- **Honest about fills** — an immediate-or-cancel order can be sent without filling, so copies record the reference price and the UI says "at about $…"; the receipt reports `tpSlAttached: false` if the exchange ever refuses the exit levels. A copy whose order succeeded is never reported as a failure, even if writing it to SQLite fails (that case is logged loudly).
- **Unhappy paths** — every SDK/chain error becomes a `TradeError` with a readable message and the original error kept on `cause`; success is never reported without a transaction hash; an empty account (404 before the first deposit) is a state, not an error.

## What's next

With another day, in this order:

1. **Outcome marking** (STRETCH): read one-minute candles since a signal was posted and mark it "hit take profit", "hit stop loss" or "expired" — the piece that turns the history into a real track record.
2. **A tiny leaderboard** from the author stats already computed (`ideas`, `copies`, and then hit rate).
3. **WebSocket** price and position updates replacing the polling, keeping polling as the fallback.
4. **Wallet-based signing** so each person copies from their own wallet instead of the shared server key — the change that removes the biggest risk below.

### Biggest risk in this submission

The private key lives on the server and the two write routes (`POST /api/order`, `POST /api/signals/[id]/copy`) have no authentication, so anyone who can reach the app can spend the testnet balance. It is mitigated by keeping the app on localhost (no deployment config exists in the repo), by `server-only` modules that keep the key out of the browser, by an environment guard that refuses anything but testnet, by a per-order size cap, and by the builder-fee bound asserted immediately before signing. The real fix is wallet-based signing in the browser, so each person copies from their own account and the server never holds a key.

The same note, with the enforcement points and how each was verified, is in [`docs/SAFETY_REVIEW.md`](docs/SAFETY_REVIEW.md).


## AI-generated vs. what I changed after reviewing it

Nearly all of the code here was drafted by an AI agent working against written specs, and then reviewed line by line before each commit. The repository carries the evidence: `openspec/changes/archive/` holds what was planned **before** any code existed, the `*.old` files next to each design hold the versions that reality forced me to correct, and the review pass after every change is a separate `fix:` commit.

What the review actually caught — these are the changes I made to the generated code, not a list of what it wrote:

- **A regex that would have placed a second real order.** The copy route retried without take-profit/stop-loss when the chain "blamed the trigger prices", detected with `/tp|sl|trigger/`. `tp` matches inside `http`, and SDK errors carry URLs, so almost any rejection would have triggered a second order. Fixed with patterns anchored to whole Move identifiers, plus a test whose failing case is literally "the message contains a URL".
- **The same class of bug, earlier.** `humanizeSdkError` classified an error as "API key rejected" because it found `401` **inside a hex package address**. Fixed with word boundaries and a Move-abort reason extractor. Two instances of the same mistake is why I now distrust substring matching over free text.
- **A wrong assumption about builder codes.** The plan said `BUILDER_ADDRESS` could be any address I control. The chain answered `EBUILDER_SUBACCOUNT_NOT_FOUND`: it must be a Decibel *subaccount*. `.env.example`, the README and a warning in `pnpm smoke` were updated.
- **A dependency that would have broken a fresh clone.** `better-sqlite3` has no prebuilt binary for Node 24 here and `node-gyp` needs a C++ toolchain. Replaced with Node's built-in `node:sqlite`, verified inside a Turbopack route handler before writing the persistence layer.
- **Markets nobody could trade.** `MAX_ORDER_SIZE` is one cap in base units, so coins whose minimum order is larger (ADA, WLFI) showed an impossible range like "between 5 and 0.01 ADA". The list now only offers what this app can actually trade.
- **An impure render and a cascading effect**, both flagged by React's compiler rules: `Date.now()` inside a component, and a `setState` in the polling hook's effect. The clock moved out of render and the hook now derives its reset from the URL it belongs to.
- **Accessibility the draft ignored:** a closed bottom sheet still reachable by Tab (fixed with `inert`), toast timers left running after unmount, tap targets under 44 px, and a coin selector that forced 36 tab stops before the main button (fixed with the ARIA roving-tabindex pattern).
- **Two honesty fixes.** A copy stores the *reference* price, not a confirmed fill, so the interface says "at about $…"; and a spec scenario used `DOGE/USD` as a market that "does not exist" — it does exist on testnet, so the scenario was corrected rather than left to pass by luck.

Two decisions I overrode after seeing the result: the size range stays out of the request schema (so every rejection quotes the same allowed range, from one place in the domain), and a list may repeat its primary action once per card — the constitution now says so explicitly instead of the code quietly breaking the old wording.

## Development process

Each feature is an OpenSpec change (`openspec/changes/<name>/`) with a proposal, a delta spec, a design and a task list; tasks are implemented one by one, each with its own verification and commit, then the change is reviewed against `specs/constitution.md` and archived. When a design decision changes during implementation, the previous artifact is kept next to it as `*.old`. The archive folder is the record of what was planned, what was built and what changed after review.

Five changes, in order: `bootstrap-app` → `decibel-testnet-connection` → `trade-screen` → `copy-trade-signals` → `polish-and-delivery`. `specs/constitution.md` holds the rules every one of them was checked against, each written as something you can actually run.

The safety review is in [`docs/SAFETY_REVIEW.md`](docs/SAFETY_REVIEW.md): every rule the brief grades, mapped to the file that enforces it and the check that was run, with the observed output.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server on <http://localhost:3000> |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` | Quality gates |
| `pnpm keygen` | New testnet account (prints the key once) |
| `pnpm smoke` | Connection check: wallet, subaccount, gas, markets, BTC mid, equity |
| `pnpm mint [amount]` | Mint test USDC (testnet faucet function) and deposit it |
| `pnpm approve` | Approve the builder fee (one-time, idempotent) |
| `pnpm order:once [size] [--sell]` | Place one real market order with the builder code |

Deleting `data/signals.db` resets the idea history; the file is created again on the next post.

Add `--verbose` to any script to see the underlying error.
