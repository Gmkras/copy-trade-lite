# Constitution — Copy-Trade Lite

Non-negotiable principles. Every spec, plan, task, commit and review is checked against this page. If a later document contradicts it, this page wins. Source brief: `decibel_engineering_test.pdf`.

## 1. Product principles

- **P1. A smart 12-year-old can use it.** Every screen has exactly one *kind* of primary action, in yellow. A list may repeat that same action once per item (each idea card carries the Copy that opens it); everything else on the screen is secondary. Check: count the distinct yellow actions on a screen; the answer is 1.
- **P2. Plain words, never exchange jargon.** "Up / Down", "How much?", "Copy this trade", "Play money (testnet)". Check: no "long/short", "IOC", "bps", "margin", "reduce-only" visible in the UI.
- **P3. Every number has context.** "1 BTC = $64,120", "≈ $64 of play money". Check: no bare number without unit or comparison.
- **P4. Social-trading feel with three screens.** Feed of ideas with Copy, Trade, Signal detail on a chart. Trader profile and leaderboard are STRETCH only. Check: the bottom nav has two tabs until STRETCH lands.
- **P5. Empty states invite; errors explain and propose.** Check: every list has a "nothing yet → do this" state; every error string says what happened and what to do next.

## 2. Engineering principles

- **E1. 100% TypeScript, `strict: true`.** No `.js` source, no `any` without a justifying comment, no `@ts-ignore`. Check: `pnpm typecheck` passes; `git ls-files | grep -E "\.jsx?$"` is empty.
- **E2. Next.js App Router, one process.** Route Handlers run with `runtime = "nodejs"`, never edge. Check: every `app/api/**/route.ts` exports `runtime`.
- **E3. SDK and secrets are server-only.** `lib/env.ts`, `lib/decibel/*`, `lib/signals/*` import `server-only`; the browser never receives the key or a `DecibelWriteDex`. Check: `grep -rn "NEXT_PUBLIC_" .` shows no secret; client components import nothing from `lib/decibel`.
- **E4. zod at every boundary, `.strict()` on every request schema.** Env, request bodies, SDK responses, DB rows. Check: every route handler's first statement parses with a schema from `lib/schemas.ts`.
- **E5. No feature without a verification step.** A task is done only when its stated command or screen check passes. Check: `specs/tasks.md` lists the verification for each task; the commit message references the task ID.
- **E6. Small commits, one task each, Conventional Commits.** Fixes from the AI-review pass are separate `fix:` commits. Check: `git log --oneline` reads like the task list.
- **E7. Confirm SDK signatures against the live docs or the installed `dist/`.** Never invent a method or argument. Check: `scripts/smoke.ts` runs green before any UI work.
- **E8. Simplicity over cleverness.** No global state library, no UI kit, no ORM, no abstraction used once. Check: `package.json` dependencies stay at or below the list in `specs/plan.md`.

## 3. Safety invariants (hard fails)

- **S1. Testnet only.** `TESTNET_CONFIG` is the only network config imported anywhere; `lib/env.ts` refuses to start unless `DECIBEL_NETWORK === "testnet"`. Check: `grep -rn MAINNET .` is empty; starting with `DECIBEL_NETWORK=mainnet` exits with a clear error.
- **S2. No secrets in the repo, ever.** `.env*` (except `.env.example`) and `data/` are gitignored from the first commit; keys are never logged. Check: `git log -p | grep -iE "priv|0x[0-9a-f]{64}"` is empty before every push.
- **S3. `builderFee <= approved maxFee <= 10 bps`, enforced server-side as a constant.** The fee comes only from `env.ts`; no request schema has a `builderFee` field; `.strict()` rejects it if sent. Check: `grep -rn builderFee app/` shows no request parsing; the order module asserts the bound before signing.
- **S4. Validate before signing.** `size > 0`, finite, `<= MAX_ORDER_SIZE`; TP/SL on the correct side (long: TP > entry > SL; short: TP < entry < SL); builder address padded to 64 hex chars; market exists. A bad input returns a friendly 422, never a signed transaction. Check: vitest covers each rule; curl with `size:0`, `size:"abc"`, unknown field returns the error envelope.
- **S5. Every unhappy path is reported, none is swallowed.** Insufficient balance, rejected tx, RPC/401 error, empty account → `{ ok:false, code, message }` in plain language and a visible UI state. Check: no empty `catch`, no unhandled promise, no "success" without a transaction hash.
- **S6. Don't fake it.** The README lists what works and what does not, per tier, and what was AI-generated vs. changed after review. Check: every claim in the README maps to a verification that was actually run.
- **S7. Localhost only.** POST routes sign with the server key and have no auth; the app is never exposed publicly. Check: README carries the warning; no deploy config in the repo.

## 4. Scope discipline

- **D1. MUST → SHOULD → STRETCH, strictly.** Smoke script and one real testnet order come before any UI. Check: commit order in `git log`.
- **D2. Cut-off rule.** If the Trade screen (T5) is not end-to-end by Saturday 18:00, no SHOULD work starts; polish MUST, write the README, record the Loom.
- **D3. Polish the demo path before adding anything.** Demo path: open app → place a trade → see the position → post a signal → open it on the chart → copy it. Check: the Loom shows exactly this, under 3 minutes.

## 5. Design principles

- **V1. Black background, Decibel yellow as the single strong accent.** Tokens: `bg #0B0B0C`, `surface #141416`, `line #26262A`, `text #F5F5F4`, `muted #9A9A9F`, `yellow #F5C400`, `up #22C55E`, `down #EF4444`. Green/red only for PnL and direction. Check: no other saturated color in the UI.
- **V2. Big type.** Inter for UI, Space Grotesk 700 for headlines and large numbers; body ≥ 16 px; primary button text ≥ 20 px.
- **V3. Mobile-first at 375 px; tap targets ≥ 44 px; loading skeletons instead of spinners; `prefers-reduced-motion` respected.** Check: T12 walkthrough at 375 px and 1280 px.
- **V4. No ALL-CAPS labels, no dense tables on the core screens.** Cards, pills and three big numbers instead.
