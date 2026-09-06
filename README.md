# Copy-Trade Lite

A dead-simple trading app on **Decibel (Aptos testnet)** that a smart 12-year-old could use, with a copy-trade signal feature on top. Built 100% in TypeScript with Next.js. **Testnet only, play money only.**

> **Status:** work in progress, built change by change with Spec-Driven Development (OpenSpec). The table in [What works today](#what-works-today) is kept honest at every commit.

## What works today

| Tier | Feature | Status |
|---|---|---|
| — | App shell: validated env + testnet guard, design tokens, base components, two-tab navigation | ✅ Done (`bootstrap-app`) |
| MUST 1 | Connect to Decibel on Aptos testnet | ⏳ Next change (`decibel-testnet-connection`) |
| MUST 2 | Real testnet order with builder codes (approve → place) | ⏳ Next change |
| MUST 3 | Kid-friendly trade screen | ⏳ Planned (`trade-screen`) |
| MUST 4 | Live account: equity, positions + PnL, open orders | ⏳ Planned (`trade-screen`) |
| SHOULD 5–8 | Signals, chart, one-click copy, history | ⏳ Planned (`copy-trade-signals`) |
| STRETCH | WebSocket, outcomes, leaderboard | ⏳ Only if everything above is solid |

## Prerequisites

- **Node.js 24** (LTS) and **pnpm 12** (`npm i -g pnpm`)
- **Git**
- Testnet credentials (below). No mainnet config exists anywhere in this repo.

## Get your credentials (≈10 minutes)

You need three values. Everything else in `.env` has safe defaults.

1. **`PRIVATE_KEY`** — the Ed25519 private key of a **testnet** wallet.
   Go to [app.decibel.trade/api](https://app.decibel.trade/api) → *API Wallet* → copy the private key.
   (From the next change you can also generate one with `pnpm tsx scripts/keygen.ts`.)
2. **`APTOS_NODE_API_KEY`** — a Geomi API key (Aptos Labs infrastructure). Without it every SDK call returns `401`.
   [geomi.dev](https://geomi.dev) → *New Project* (any name, e.g. `copy-trade-lite-testnet`) → *API Keys* → *Create New API Key* → **Network: Testnet**, **Client usage: OFF** (the key stays on the server).
3. **`BUILDER_ADDRESS`** — the public address of a wallet you control on testnet. The simplest choice is the address of the API Wallet from step 1 (shown on the same page).

Then fund the wallet with testnet APT for gas: [aptos.dev/network/faucet](https://aptos.dev/network/faucet). Test USDC and the builder-fee approval are handled by scripts in the next change.

## Run it locally

```bash
git clone <this repo> copy-trade-lite
cd copy-trade-lite
pnpm install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
```

Open `.env` and fill in `PRIVATE_KEY`, `APTOS_NODE_API_KEY` and `BUILDER_ADDRESS`. Leave the rest as is:

```
BUILDER_FEE_BPS=10          # protocol cap; also the per-order fee
DECIBEL_NETWORK=testnet     # anything else refuses to start
MAX_ORDER_SIZE=0.01         # fat-finger cap in base units (BTC)
DB_PATH=./data/signals.db   # SQLite file, created on first use
```

Start the app:

```bash
pnpm dev
```

Expected terminal output:

```
▲ Next.js 16.x (Turbopack)
- Local:  http://localhost:3000
✓ Ready in ~1s
```

Open <http://localhost:3000>. You should see a black page with a yellow **Copy-Trade Lite** headline and a bottom bar with two tabs, **Feed** and **Trade**.

> **Security note — localhost only.** The private key lives on the server side of this app and the write routes (coming in later changes) have no authentication. Do not expose the dev server to the internet. See [Safety](#safety).

## Manual test checklist (current state)

Use a phone-sized viewport (DevTools → device toolbar → 375 px) to see the intended layout.

**Environment guard** (the app must refuse to start on a bad config):

| Change in `.env` | Run `pnpm dev` | Expect |
|---|---|---|
| `DECIBEL_NETWORK=mainnet` | | exits with `DECIBEL_NETWORK must be exactly "testnet" — mainnet is never allowed` |
| `BUILDER_FEE_BPS=11` | | exits with `BUILDER_FEE_BPS must be between 0 and 10 basis points (protocol cap)` |
| `PRIVATE_KEY=` (empty) | | exits with `PRIVATE_KEY is required …`; no secret value is printed |

Restore the values afterwards.

**Shell and navigation:**

- [ ] `/` shows the yellow headline in Space Grotesk on a black background; no other saturated color.
- [ ] Tap **Trade** → URL becomes `/trade`, the Trade tab turns yellow, the page says the trade screen is coming.
- [ ] Tap **Feed** → back to `/`, the Feed tab is yellow.
- [ ] Tab targets are at least 44 px tall; keyboard focus shows a yellow ring.

**Quality gates:**

```bash
pnpm typecheck   # tsc --noEmit, strict
pnpm lint        # eslint (next/core-web-vitals + typescript)
pnpm test        # vitest (no tests yet in this change)
pnpm build       # production build; must succeed
```

**Server-only boundary (optional, proves secrets can't reach the browser):** add `import { env } from "@/lib/env";` to `components/BottomNav.tsx` and run `pnpm build`. It must fail with `You're importing a module that depends on "server-only"`. Remove the line; the build passes again.

## Project structure

```
app/                 Next.js App Router (layout, home, /trade)
components/          BigButton, Card, Sheet, Toast, BottomNav — hand-written, no UI kit
lib/env.schema.ts    zod schema + loadEnv() (used by next.config.ts at startup)
lib/env.ts           server-only frozen env for app code
specs/constitution.md  Non-negotiable rules with executable checks
openspec/            SDD artifacts: config, active changes, archive (process evidence)
.env.example         Every variable, documented
```

## Safety

Graded explicitly by the brief; enforced in code, not by convention:

- **Testnet only** — `DECIBEL_NETWORK` must equal `testnet` or the process exits (`lib/env.schema.ts`, run from `next.config.ts`).
- **No secrets in the repo** — `.env*` and `data/` are gitignored since the first commit; `.env.example` has no real values.
- **Secrets never reach the browser** — `lib/env.ts` imports `server-only`; a client component importing it breaks the build (verified).
- **Builder fee bound** — `BUILDER_FEE_BPS` is validated `0..10` at startup and will be the only source of the per-order fee.
- **Size cap** — `MAX_ORDER_SIZE` limits any order the app will ever sign.

Biggest risk in this design: the private key on the server behind unauthenticated write routes. Mitigation: server-only modules, startup validation, size cap, and keeping the app on localhost. The next step would be wallet-based signing in the browser.

## Development process

Each feature is an OpenSpec change (`openspec/changes/<name>/`) with a proposal, a delta spec, a design and a task list; tasks are implemented one by one, each with its own verification and commit, then the change is reviewed against `specs/constitution.md` and archived. The archive folder is the record of what was planned, what was built and what changed after review.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server on <http://localhost:3000> |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm typecheck` | TypeScript strict check |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest |
