# Copy-Trade Lite

A dead-simple trading app on **Decibel (Aptos testnet)** that a smart 12-year-old could use, with a copy-trade signal feature on top. Built 100% in TypeScript with Next.js. **Testnet only, play money only.**

> **Status:** work in progress, built change by change with Spec-Driven Development (OpenSpec). The table in [What works today](#what-works-today) is kept honest at every commit.

## What works today

| Tier | Feature | Status |
|---|---|---|
| — | App shell: validated env + testnet guard, design tokens, base components, two-tab navigation | ✅ Done (`bootstrap-app`) |
| MUST 1 | Connect to Decibel on Aptos testnet and authenticate the account | ✅ Done (`decibel-testnet-connection`) — `pnpm smoke` |
| MUST 2 | Real testnet order with builder codes (approve → place), fee bound enforced | ✅ Done (`decibel-testnet-connection`) — `pnpm approve`, `pnpm order:once` |
| MUST 3 | Kid-friendly trade screen | ⏳ Next change (`trade-screen`) |
| MUST 4 | Live account: equity, positions + PnL, open orders | ⏳ Next change (`trade-screen`) |
| SHOULD 5–8 | Signals, chart, one-click copy, history | ⏳ Planned (`copy-trade-signals`) |
| STRETCH | WebSocket, outcomes, leaderboard | ⏳ Only if everything above is solid |

Proof for MUST 2 (Aptos testnet explorer): order `0x5f433998292cf8350bbbb92e52fd334c70e4c92c98132b90caf6f73291f86875`, builder-fee approval `0x0c237551c7a68fad58c6999cc0f883fc78bce6d947cf845f384d34fa5e198f24`.

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

5. Approve the builder fee once (step 1 of builder codes; safe to re-run):

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

7. Start the app (currently the shell only; the trade screen arrives in the next change):

   ```bash
   pnpm dev          # http://localhost:3000
   ```

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

**Shell and navigation** (`pnpm dev`, phone-sized viewport, 375 px):

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
app/                   Next.js App Router (layout, home, /trade)
components/            BigButton, Card, Sheet, Toast, BottomNav — hand-written, no UI kit
lib/env.schema.ts      zod schema + loadEnv() (used by next.config.ts and scripts)
lib/env.ts             server-only frozen env for app code
lib/decibel/client.ts  SDK clients built once from env (TESTNET_CONFIG only), wallet/subaccount/builder
lib/decibel/units.ts   chain-unit math: tick/lot rounding, size bounds (tests)
lib/decibel/orders.ts  approveBuilderFee, placeMarketOrder with the fee bound asserted last (tests)
lib/decibel/errors.ts  TradeError + plain-language mapping of SDK/chain errors
lib/decibel/index.ts   server-only gate: the only import path for app code
scripts/               keygen, smoke, mint-usdc, approve-builder, order-once (tsx)
specs/constitution.md  Non-negotiable rules with executable checks
openspec/              SDD artifacts: config, active changes, archive (process evidence)
data/                  gitignored: builder-approval.json, signals.db
```

## Safety

Graded explicitly by the brief; enforced in code, not by convention:

- **Testnet only** — `TESTNET_CONFIG` is the only Decibel config imported (`lib/decibel/client.ts`); `DECIBEL_NETWORK` must equal `testnet` or the process exits (`lib/env.schema.ts`, run from `next.config.ts` and every script).
- **No secrets in the repo** — `.env*` and `data/` are gitignored since the first commit; `.env.example` has no real values; scripts never print keys.
- **Secrets never reach the browser** — `lib/env.ts` and `lib/decibel/index.ts` import `server-only`; a client component importing them breaks the build (verified).
- **Builder fee bound** — the fee is a server constant (`BUILDER_FEE_BPS`, validated `0..10` at startup); no function takes a fee parameter; `assertFeeBound` checks `fee ≤ approved max ≤ 10` immediately before the transaction is built, against the approval recorded by `pnpm approve`.
- **Validate before signing** — `toValidOrderSize` (finite, > 0, ≥ market minimum, ≤ `MAX_ORDER_SIZE`) and `assertTpSlSides` run before any pricing or signing; every rejection is a plain-language message with the allowed range.
- **Unhappy paths** — every SDK/chain error becomes a `TradeError` with a readable message and the original error kept on `cause`; success is never reported without a transaction hash; an empty account (404 before the first deposit) is a state, not an error.

Biggest risk in this design: the private key on the server behind unauthenticated write routes (coming with the trade screen). Mitigation: server-only modules, startup validation, the size cap, the fee bound asserted last, and keeping the app on localhost. The next step would be wallet-based signing in the browser.

## Development process

Each feature is an OpenSpec change (`openspec/changes/<name>/`) with a proposal, a delta spec, a design and a task list; tasks are implemented one by one, each with its own verification and commit, then the change is reviewed against `specs/constitution.md` and archived. When a design decision changes during implementation, the previous artifact is kept next to it as `*.old`. The archive folder is the record of what was planned, what was built and what changed after review.

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

Add `--verbose` to any script to see the underlying error.
