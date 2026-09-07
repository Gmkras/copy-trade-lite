## 1. Foundation: hook, nav, background (≈60 min)

- [ ] 1.1 Create `hooks/useMediaQuery.ts` (`useSyncExternalStore`, server snapshot `false`, subscribes to `matchMedia(query)` changes) and export `WIDE = "(min-width: 1024px)"`. Verify: `pnpm typecheck` and `pnpm lint` exit 0; a throwaway `console.log` in the Trade page shows `false` on the server render and `true` after hydration at 1280 px (remove it).
- [ ] 1.2 Rename `BottomNav` to `AppNav` per design D3: inline-SVG icon + label per tab, `aria-current`, opaque `bg-bg` (no blur), `padding-bottom: env(safe-area-inset-bottom)` below 1024 px; top bar with the wordmark and the "play money · testnet" chip from 1024 px; `body` paddings `pb-16 lg:pb-0 lg:pt-16`; body background gradient (D5) in `globals.css`; constitution P4 check reworded. Verify with agent-browser: at 375 px the bar is at the bottom, opaque (computed `backdrop-filter: none`, background alpha 1), both tabs ≥ 44 px tall with an icon and a label, active tab yellow; at 1280 px the bar is at the top with the wordmark; screenshots of both.

## 2. Two columns (≈90 min)

- [ ] 2.1 Feed side by side (D2, D4): `app/page.tsx` renders `Feed` in the left column and a new `components/DetailRail.tsx` (client; `useMediaQuery(WIDE)`; renders `SignalDetail` for the newest live idea from the feed data, or an inviting empty panel) in the right; `app/signals/[id]/page.tsx` renders a new `components/FeedRail.tsx` (client; polls `/api/signals` only when wide, renders the cards) on the left and the detail on the right; both pages `lg:grid lg:max-w-6xl`. Verify with agent-browser: at 1280 px `/` shows the list and the newest idea's chart + copy panel; "See it on the chart" on another card changes the URL and the right column; at 375 px `/signals/[id]` makes no request to `/api/signals` (network log) and looks as before.
- [ ] 2.2 Trade side by side: `TradeScreen` gets the grid with the account card `lg:sticky lg:top-20` and an inner scroll cap; `TradeForm` picks the chart height (260 wide / 110 phone) through the hook. Verify: at 1280 × 800 the form and the account card are both visible without scrolling and the chart is ≥ 240 px tall; at 375 × 812 the yellow button's bottom edge is still above the nav (re-measure, target ≤ 755).
- [ ] 2.3 Sheet as a dialog on wide screens (D6). Verify: at 1280 px "Post an idea" opens centered, ≤ 512 px wide, over a dimmed page, closes with Escape and with a backdrop click; at 375 px it still slides up from the bottom; `prefers-reduced-motion` shows no transition in either.

## 3. Walkthrough, docs and the live check (≈45 min)

- [ ] 3.1 Repeat the simplicity walkthrough at 1280 px on the three screens: exactly one yellow action kind per screen (computed-colour scan, inert sheets excluded), no jargon, tap targets ≥ 44 px, keyboard order follows the visual order (Tab through the top bar, then the left column, then the right). Verify: numbers recorded in this file; any failure fixed before 3.2.
- [ ] 3.2 README: "Try the deployed demo" mentions laptop and phone; a "Desktop" line in the status table; project structure (`AppNav`, `DetailRail`, `FeedRail`, `useMediaQuery`); a 1280 px screenshot of the feed next to the phone one. Interview guide gains the section. Verify: `grep -n BottomNav README.md` → none.
- [ ] 3.3 After the push and the Vercel deploy: at 1280 px on the live URL the feed shows two columns and the top bar; at 375 px the bottom bar is opaque with icons and the feed is unchanged. Record the deployment in the commit body.

## 4. Change review

- [ ] 4.1 Run the P-R review prompt on the diff against `specs/constitution.md`, with one extra question: does any component fetch or render the second column below 1024 px. Verify: findings fixed in a separate `fix:` commit, or "no findings" recorded here.
