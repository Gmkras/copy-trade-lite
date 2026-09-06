## 1. Scaffold (≈45 min)

- [x] 1.1 Run `pnpm create next-app@latest . --ts --app --tailwind --eslint --src-dir=false --import-alias "@/*" --use-pnpm` in the repo root (keep the existing `.gitignore`, `CLAUDE.md`, `specs/`, `openspec/`, `.claude/`); remove the demo content from `app/page.tsx`; set `"strict": true` in `tsconfig.json`; add scripts `typecheck` (`tsc --noEmit`) and `test` (`vitest run`); add `vitest` and `server-only` as dependencies. Verify: `pnpm typecheck` and `pnpm lint` exit 0; `git ls-files | grep -E "\.jsx?$"` returns nothing; `git status` shows no `.env` or `node_modules`.
- [x] 1.2 Create `vitest.config.ts` (`environment: "node"`, include `**/*.test.ts`). Verify: `pnpm test` runs and reports "no test files found" without error.

## 2. Environment validation (≈60 min)

- [x] 2.1 Create `lib/env.ts` with `import "server-only"`, the zod schema from design D3, one parse at module load, a frozen exported `env`, and an error message that lists each invalid variable with its expectation and points to `.env.example` without echoing values. Verify: `pnpm typecheck` exits 0.
- [x] 2.2 Create `.env.example` with every variable, a comment per variable (purpose, format, where to get it: app.decibel.trade/api or keygen script, geomi.dev, own wallet address, protocol cap 10 bps, testnet only, size cap, db path) and no real values. Verify: `git ls-files | grep env` lists only `.env.example`.
- [x] 2.3 Import `lib/env.ts` from `next.config.ts` so validation runs at startup. Verify: with a valid `.env`, `pnpm dev` starts and `http://localhost:3000` renders.
- [x] 2.4 Verify the guard: with `DECIBEL_NETWORK=mainnet` the dev server refuses to start and prints the testnet-only message; with `BUILDER_FEE_BPS=11` it prints the 0–10 bps message; with `PRIVATE_KEY` empty it names `PRIVATE_KEY` and shows no secret. Record the three outputs in the commit message body.

## 3. Design tokens, fonts and base components (≈60 min)

- [x] 3.1 Replace `app/globals.css` with the Tailwind v4 `@theme` block from design D4 plus base styles (black body, 16 px minimum text, visible focus ring, `prefers-reduced-motion` rule). Load Inter and Space Grotesk with `next/font/google` in `app/layout.tsx`. Verify: `pnpm dev` shows a black page and the computed font of `h1` is Space Grotesk (DevTools).
- [x] 3.2 Create `components/BigButton.tsx`, `components/Card.tsx`, `components/Sheet.tsx` (bottom sheet with backdrop, closes on backdrop click and Escape) and `components/Toast.tsx` (`ToastProvider` + `useToast()`, auto-dismiss 4 s, `aria-live="polite"`). Verify: a temporary demo on the home page shows all four working at 375 px (button pending state, sheet open/close, toast auto-dismiss); remove the demo before committing.

## 4. Layout, navigation and placeholder pages (≈45 min)

- [x] 4.1 Build `components/BottomNav.tsx` (client, `usePathname`, two tabs Feed `/` and Trade `/trade`, active tab yellow, tap targets ≥ 44 px) and wire it with `ToastProvider` in `app/layout.tsx`. Verify: tapping each tab changes the URL and the highlight at 375 px.
- [x] 4.2 Write `app/page.tsx` (yellow "Copy-Trade Lite" headline in Space Grotesk on black, one-line plain-language subtitle) and `app/trade/page.tsx` (placeholder stating in plain language that the trade screen is coming). Verify: both routes render with no console errors at 375 px and 1280 px; no saturated color other than yellow is visible.
- [x] 4.3 Client-boundary check: temporarily add `import { env } from "@/lib/env"` to `BottomNav.tsx` and run `pnpm build`. Verify: the build fails with the server-only error; revert the import; `pnpm build` then succeeds. Note the result in the commit body.

- [x] 4.4 (added on request) Write `README.md` v1: honest status table per tier, credentials guide, run-it-locally steps with expected output, manual test checklist for the current state, safety section. Verify: a reader can start the app and run the env-guard checks from the README alone.

## 5. Change review

- [x] 5.1 Run the P-R review prompt on the diff of this change against `specs/constitution.md` (safety, correctness, clarity). Verify: findings fixed in a separate `fix:` commit, or "no findings" recorded.
