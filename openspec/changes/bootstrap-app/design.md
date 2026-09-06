## Context

Greenfield repository: only `.gitignore`, `CLAUDE.md`, `specs/constitution.md` and the OpenSpec scaffold exist. Toolchain on the dev machine: Node 24.19, pnpm 12, Git 2.55, Windows 10. Latest stable packages at planning time: `create-next-app` 16.3 (Next.js 16, App Router, Turbopack by default), Tailwind 4.3 (CSS-first configuration, no `tailwind.config.js`), `zod` 3.x (peer dependency of the Decibel SDK that arrives in the next change). See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- One place where secrets are read (`lib/env.ts`), enforced as server-only by the bundler, not by convention.
- The testnet guard is a *startup* failure, not a runtime check hidden in a route.
- Tokens and components make later screens trivially consistent with the constitution.

**Non-Goals:**
- Any SDK import, API route, database, or trading UI (next changes).
- Theming, dark/light toggle, i18n.

## Decisions

### D1. Next.js 16 App Router via `create-next-app@latest`, not pinned to 15
Rationale: current stable is what a reviewer will install; it ships Turbopack, React 19 and Tailwind v4 defaults, and the App Router API used here (layouts, `runtime = "nodejs"` route handlers) is unchanged. Alternative: pin Next 15 to match the plan wording — rejected, no benefit and older defaults. Route Handlers in later changes must declare `export const runtime = "nodejs"` because the SDK uses Node crypto and `ws`.

### D2. Server-only modules
`lib/env.ts` starts with `import "server-only"`. Any `"use client"` component that imports it makes the build fail. Later changes apply the same import to `lib/decibel/*` and `lib/signals/*`. Alternative: rely on naming convention — rejected, the constitution (E3) requires a tool-enforced check.

### D3. Environment schema (zod) and fail-fast
```
PRIVATE_KEY         z.string().min(1)                  // format validated by the SDK in the next change
APTOS_NODE_API_KEY  z.string().min(1)
BUILDER_ADDRESS     z.string().regex(/^(0x)?[0-9a-fA-F]{1,64}$/)
BUILDER_FEE_BPS     z.coerce.number().int().min(0).max(10)
DECIBEL_NETWORK     z.literal("testnet")
MAX_ORDER_SIZE      z.coerce.number().positive().default(0.01)
DB_PATH             z.string().default("./data/signals.db")
```
Enforcement: `lib/env.ts` parses `process.env` once at module load and exports a frozen `env` object. On failure it throws an `Error` whose message lists each invalid variable with the expectation and a pointer to `.env.example`, never echoing values. `next.config.ts` imports `lib/env.ts` so the failure happens on `pnpm dev`/`pnpm build` startup, before any page compiles. Alternative: validate lazily in each route — rejected, a bad config must never reach a request.

### D4. Tailwind v4 `@theme` tokens in `app/globals.css`
```
@theme {
  --color-bg: #0B0B0C; --color-surface: #141416; --color-line: #26262A;
  --color-text: #F5F5F4; --color-muted: #9A9A9F; --color-yellow: #F5C400;
  --color-up: #22C55E; --color-down: #EF4444;
  --font-sans: "Inter", system-ui, sans-serif;
  --font-display: "Space Grotesk", "Inter", sans-serif;
  --radius-card: 16px;
}
```
Usage: `bg-bg`, `text-text`, `bg-yellow`, `font-display`. Fonts loaded with `next/font/google` (self-hosted at build, no runtime request). Alternative: Tailwind v3 with `tailwind.config.ts` — rejected, v4 is the scaffold default and needs less config.

### D5. Four hand-written components, no UI kit
`components/BigButton.tsx` (full-width, yellow, `pending` prop disables and shows a spinner-free "…" label), `components/Card.tsx`, `components/Sheet.tsx` (fixed bottom panel + dim backdrop, closes on backdrop click and Escape, `prefers-reduced-motion` respected), `components/Toast.tsx` (context provider + `useToast()` hook, auto-dismiss 4 s, `aria-live="polite"`). Alternative: shadcn/ui — rejected per constitution E8.

### D6. Layout and navigation
`app/layout.tsx` renders fonts, `ToastProvider`, the page, and `components/BottomNav.tsx` (client component using `usePathname()` to highlight the active tab). `app/page.tsx` is the placeholder home; `app/trade/page.tsx` is a placeholder that says the screen is coming. Both are server components.

### D7. Scripts
`dev`, `build`, `start`, `lint` (next lint / eslint), `typecheck` (`tsc --noEmit`), `test` (`vitest run`). `vitest.config.ts` with `environment: "node"`; the first tests arrive with `lib/decibel/units.ts` in the next change.

## Risks / Trade-offs

- [Next 16 differs from the plan text and from Tailwind v3 tutorials the reviewer may know] → the README states versions; the constitution never named a version.
- [Validating env in `next.config.ts` runs it in the Next CLI process, which may load `.env` differently from the server] → Next loads `.env` before evaluating `next.config.ts`; verified in task 2.4 by running with a bad value.
- [Tailwind v4 `@theme` names collide with defaults (e.g. `text`)] → tokens are namespaced by usage (`--color-text` produces `text-text`); acceptable, documented in the guide.
- [`server-only` package may not be needed if Next bundles it] → installing it is harmless and makes the intent explicit.

## Migration Plan

Greenfield; no migration. Rollback is deleting the change.

## Open Questions

None that affect specs or tasks. Whether `BUILDER_ADDRESS` must be the wallet address itself is answered in the next change when the SDK is installed.
