# CLAUDE.md — Copy-Trade Lite (Decibel take-home)

This file is the source of truth for how this project is built. Every spec, plan, task and line of code must obey it. The brief it derives from is `../decibel_engineering_test.pdf` ("Decibel Engineering Take-Home: Copy-Trade Lite").

## 0. Non-negotiable language rule

**The entire codebase is TypeScript.** Frontend, backend/API, scripts, tests, config where possible (`*.ts` / `*.tsx`). No JavaScript source files, no Rust, no other languages. If a tool needs a `.js` config file that cannot be `.ts`, keep it minimal and document why.

- `tsconfig` with `"strict": true`. No `any` unless justified with a comment. No `@ts-ignore`.
- Run scripts with `tsx`; do not hand-write JS.
- Use the official TypeScript SDK: `@decibeltrade/sdk` together with `@aptos-labs/ts-sdk`.

## 1. What we are building

Decibel is an on-chain perpetuals exchange on Aptos. We build the opposite of its dense pro UI: a **dead-simple trading app a non-trader (a smart 12-year-old) could use**, with a **copy-trade signal** feature on top.

- A **signal author** posts a trade idea: *"Long BTC, entry at live price, take profit +3%, stop loss −2%, hold 4h."*
- Anyone else opens the app, sees that idea **visualized on a chart**, clicks **one button**, and the same trade is pre-filled and submitted **from their own account on testnet**.
- Every posted signal is saved to a running **history / track record**.

Ship a working MVP. **Working and simple beats feature-complete and broken.**

## 2. Hard requirements

1. Use `@decibeltrade/sdk`.
2. **Aptos testnet only.** Never mainnet, never real funds.
3. Time box: one weekend of focused work. We are optimizing for scoping and shipping, not breadth.

## 3. Scope tiers (do them strictly in this order)

Finish MUST and make sure it actually runs before touching SHOULD. Finish SHOULD before STRETCH. If the core is done early, **stop and polish it** rather than bolting on features. A flawless MUST plus one STRETCH beats a half-broken everything.

### MUST (core — this is the test)
1. **Connect to Decibel on Aptos testnet** and authenticate a wallet/account. A hardcoded test key from an env var is fine for the MVP (see SAFETY).
2. **Place a real trade on testnet using builder codes** — the two-step *approve-then-place* flow — with our own builder address.
3. **Simplified "kid-friendly" trade screen**: pick a market (BTC is enough), pick Buy/Sell, pick a size, hit one big button. No jargon walls, no hidden settings.
4. **Show account state live-ish**: current balance/equity, open positions (with PnL), open orders. Polling is acceptable; real-time WS is STRETCH.

### SHOULD (the differentiator: copy-trade)
5. **Signal authoring** form: market, side, Entry = live market price (auto-filled from the SDK), TP % (above entry), SL % (below entry), hold duration.
6. **Visualize the signal on a chart**: price plus entry / TP / SL lines so the trade is obvious.
7. **One-click copy**: another user opens the signal, clicks once, and the equivalent order is pre-filled and submitted from *their* account with the builder code attached.
8. **Signal history / track record**: persist every posted signal (any store) and list them with enough info to judge an author over time.

### STRETCH (only if MUST + SHOULD are solid)
- Real-time updates via WebSocket subscriptions instead of polling.
- Mark signal outcome (hit TP / hit SL / expired) by reading back fills/positions.
- A tiny author leaderboard from the signal history.
- Mobile-friendly layout.

## 4. SAFETY rules (graded explicitly — automatic fails included)

Treat every item as a hard invariant. Before marking any task done, re-check this list.

1. **Testnet only.** `TESTNET_CONFIG` is the only network config imported anywhere. Any mainnet config, URL, or real funds is an automatic fail. The env loader must refuse to start if the network is not testnet.
2. **No secrets in the repo.** Private keys and API keys come only from env vars / `.env` (gitignored from the very first commit). Never log them. A committed key is an automatic fail. Never put secrets in anything exposed to the browser (e.g. `NEXT_PUBLIC_*`, `VITE_*`).
3. **Respect the builder-fee approval bound.** `builderFee` on an order must **never exceed the `maxFee`** the user approved (protocol cap: 10 bps). The fee is a server-side constant; it is never accepted from a client request and never silently bumped.
4. **Validate all user input before signing anything.** Size > 0 and finite (no `NaN`), TP/SL on the correct side of entry (long: TP > entry > SL; short: TP < entry < SL), builder address padded to 64 hex chars. A bad number produces a **friendly error**, not a broken or blocked transaction. Validate on the server with `zod` (`.strict()`), even if the client also validates.
5. **Handle the unhappy path.** Insufficient balance, rejected/failed tx, RPC error, a user with no positions — none of these may crash or silently "succeed". Every error is mapped to a plain-language message and shown to the user. No empty `catch`, no unhandled promises, no "success" without a transaction hash.
6. **Don't fake it.** If a feature doesn't work, say so in the README. Never claim something works when it doesn't — that is worse than a missing feature.

## 5. Engineering rules

- **Server-only SDK access.** The private key and the `DecibelWriteDex` instance live only in server code (mark modules `server-only` or keep them out of any client bundle). The browser never sees the key.
- **One validated boundary.** Every request that can lead to `placeOrder` passes through a shared `zod` schema module first.
- **Chain units.** Prices and sizes sent to the SDK are integers in chain units: price rounded to `tick_size` using `px_decimals`; size floored to `lot_size` using `sz_decimals` and at least `min_size`. Keep this in one `units.ts` with unit tests.
- **Builder-code flow is two steps:** `approveMaxBuilderFee` once (idempotent script), then every `placeOrder` carries `builderAddr` + `builderFee <= maxFee`.
- **Confirm SDK method args against the live docs** (`https://docs.decibel.trade/llms.txt` first; then `/typescript-sdk/overview`, `/installation`, `/configuration`, `/typescript-sdk/read-sdk`, `/typescript-sdk/write-sdk`, `/quickstart/placing-your-first-order`, `/quickstart/builder-codes`, `/quickstart/authenticated-requests`, `/api-reference/websocket/overview`). The snippet below is a map, not gospel. Do not invent signatures.
- **No feature without a verification step.** Each task states how it is verified (command to run or screen to open) and is not done until that passes.
- **Small commits with clear messages.** One task → one commit. Clear history is a deliverable.
- **Review AI output** for clarity, correctness and safety before committing. Keep a log of what was AI-generated and what was changed after review; it goes into the README.
- **Simplicity over cleverness.** No global state libraries, no abstractions for one use, no dead code.

## 6. Verified SDK surface (from the brief)

```ts
import { DecibelWriteDex, DecibelReadDex, TESTNET_CONFIG, TimeInForce } from "@decibeltrade/sdk";
import { Ed25519Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const user = new Ed25519Account({ privateKey: new Ed25519PrivateKey(process.env.PRIVATE_KEY!) });
const dex  = new DecibelWriteDex(TESTNET_CONFIG, user, { skipSimulate: true });
const read = new DecibelReadDex(TESTNET_CONFIG);

// READ: power the dashboard
await read.markets.getAll();
await read.marketPrices.getByName(/* "BTC/USD" */);     // live entry price for a signal
await read.accountOverview.getByAddr(addr);              // equity / balance
await read.userPositions.getBySubaccount(/* ... */);     // open positions + PnL
await read.userOpenOrders.getBySubaccount(/* ... */);    // open orders
await read.userTradeHistory.getBySubaccount(/* ... */);  // fills

// BUILDER CODE: two steps, approve THEN place
const builderAddr = "0x" + yourBuilder.padStart(64, "0"); // 64-char padded
await dex.approveMaxBuilderFee({ builderAddr, maxFee: 10 }); // bps; one-time
await dex.placeOrder({
  marketName: "BTC/USD", price, size, isBuy: true,
  timeInForce: TimeInForce.ImmediateOrCancel, isReduceOnly: false,
  builderAddr, builderFee: 10, // must be <= maxFee
});
```

Notes verified against the installed SDK (see `../PLAN_TS_SDD.md` §6 for the full list): the read/write clients require a `nodeApiKey` (Geomi API key) or calls return 401; reads use the **primary subaccount address** (`write.getPrimarySubaccountAddress(account.accountAddress)`), not the wallet address; `placeOrder` returns `{ success, transactionHash, orderId } | { success: false, error }`.

## 7. Product & UI rules

- One primary action per screen — one big button. Everything else is secondary.
- Plain words, not exchange jargon: "Up / Down", "How much?", "Copy this trade", "Play money (testnet)".
- Every number has context ("1 BTC = $64,120", "≈ $64 of play money").
- Empty states invite the next step; errors say what happened and what to do.
- Pending → success (with explorer link) → error states are always visible for any transaction.
- Polish the **demo path** first: connect → place a trade → see the position → post a signal → open it on the chart → copy it. Reviewers run exactly that path first.

## 8. Deliverables (must exist before submitting)

1. A git repo with clear commit history.
2. `README.md` (English) with: how to run it; what's done vs. not done per tier (honest); what you'd do next with another day; which parts were AI-generated and what was changed after review.
3. Proof it runs: a < 3 min screen recording of placing a testnet trade and copying a signal, **or** a deployed link.
4. A ~5-line note on the biggest safety risk in the submission and how it was mitigated.

## 9. How it is graded (optimize for this)

1. **Ship-fast MVP instinct** (highest weight): a real, working thing live on testnet, with the right corners cut.
2. **Review of AI output** for clarity, correctness and safety — not pasted blindly.
3. **Coherent copy-trade product** and a **genuinely simple UI**.

A working MUST tier plus an honest README beats an ambitious broken submission.

## 10. Pre-submission checklist

- [ ] Smoke script and a real testnet order work from a clean `.env` filled from `.env.example`.
- [ ] `size=0`, `size=abc`, unknown fields, insufficient balance, invalid API key and network down all show clear messages — never a broken screen.
- [ ] `builderFee` exists only in the env/config module; no request schema accepts it.
- [ ] No `MAINNET` config or mainnet URL anywhere; env loader rejects non-testnet.
- [ ] `git log -p | grep -iE "priv|0x[0-9a-f]{64}"` is clean; `.env*` gitignored since the first commit.
- [ ] README is honest per tier, lists AI-generated vs. reviewed changes, includes the 5-line safety note.
- [ ] Every source file is TypeScript; `tsc --noEmit` passes with `strict`.
