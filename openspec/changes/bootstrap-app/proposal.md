## Why

Every MUST-tier feature (testnet connection, real order, trade screen, live account) needs a running TypeScript app with a validated environment and the design tokens in place. Nothing from the brief can be verified until this foundation exists, so it comes first.

**Tier served:** MUST (prerequisite for MUST 1–4).

## What Changes

- Scaffold a Next.js App Router project (current stable, `create-next-app@16`) in TypeScript `strict`, Tailwind v4, ESLint, pnpm. No UI kit, no state library, no `.js` source files.
- Add a server-only environment module that validates `process.env` with zod at startup and **refuses to start** unless `DECIBEL_NETWORK` is exactly `testnet`, `BUILDER_FEE_BPS` is `<= 10`, and all required secrets are present. Defaults: `MAX_ORDER_SIZE = 0.01`, `DB_PATH = ./data/signals.db`.
- Add `.env.example` documenting every variable and where to obtain it; keep `.env*` and `data/` gitignored (already in place).
- Define the design tokens from `specs/constitution.md` §5 (`bg`, `surface`, `line`, `text`, `muted`, `yellow`, `up`, `down`) as Tailwind v4 `@theme` tokens, plus fonts Inter and Space Grotesk.
- Add four minimal components: `BigButton`, `Card`, `Sheet` (bottom sheet), `Toast`.
- Add the root layout with a two-tab bottom navigation (Feed, Trade) and a placeholder home page: yellow "Copy-Trade Lite" headline on black.
- Add pnpm scripts: `dev`, `build`, `typecheck`, `lint`, `test` (vitest configured, no tests yet).

## Capabilities

### New Capabilities
- `app-shell`: the application shell — validated environment and testnet guard, design tokens, base components, navigation, and the placeholder home.

### Modified Capabilities
- (none)

## Non-goals

- No calls to `@decibeltrade/sdk`; no private key is used yet (only validated as present).
- No API routes, no persistence, no trading UI.
- No deployment configuration; the app runs on localhost only.

## Impact

- New files: `app/`, `lib/env.ts`, `components/`, `.env.example`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `postcss.config.*`, `next.config.ts`, `eslint.config.*`.
- New dependencies: `next`, `react`, `react-dom`, `tailwindcss`, `@tailwindcss/postcss`, `zod`, `server-only`; dev: `typescript`, `vitest`, `eslint`, `eslint-config-next`.
- Every later change builds on `lib/env.ts` (the only place secrets are read) and on the tokens/components.
