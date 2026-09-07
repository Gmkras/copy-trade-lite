## Context

Every page is `<main className="mx-auto … max-w-lg p-6">` with a fixed `BottomNav` (`bg-bg/95 backdrop-blur`) and `body { pb-16 }`. `Feed` (client) polls `/api/signals` and renders cards; `SignalDetail` (client) polls `/api/signals/[id]` and owns the chart, copy panel and copies list; `TradeScreen` (client) owns the account poll and renders `TradeForm` + `AccountCard`; `TradeForm` sets the chart height to a constant measured for 375 × 812. `Sheet` is a fixed full-screen layer with the dialog at the bottom. Tailwind v4 with `@theme` tokens; no media-query hook exists. Constitution: V1 palette, V3 "walkthrough at 375 px and 1280 px", P4 "bottom nav has two tabs". See proposal.md for why.

## Goals / Non-Goals

**Goals:**
- One set of routes and components, two layouts; CSS decides wherever it can.
- Wide screens get a real second column, not a wider single one.
- No extra work for phones: nothing fetched, no layout shift.

**Non-Goals:**
- A separate desktop design language, tables or denser components (V4 stands).

## Decisions

### D1. CSS-first responsiveness, JavaScript only where the DOM must differ
Grids, paddings, nav position and sheet placement are Tailwind `lg:` variants (1024 px) — they render correctly on the server and never shift. JavaScript is used for exactly two things that CSS cannot do: fetching the second column's data only when it is shown, and choosing the Trade chart height. Both go through one `useMediaQuery(query)` hook built on `useSyncExternalStore` with a server snapshot of `false`, so the server and the first client render agree (mobile) and the wide version appears right after hydration. Alternative: user-agent sniffing on the server — rejected, a resized window would be wrong and it is exactly the kind of cleverness the constitution forbids.

### D2. The second column reuses the detail component and keeps the URLs
`/` at ≥ 1024 renders `Feed` on the left and `DetailRail` on the right: a client component that, when wide, mounts `SignalDetail` for the newest live idea from the feed data it already has (the detail polls its own route for copies and candles, as it does today). `/signals/[id]` at ≥ 1024 renders `FeedRail` on the left — a client component that, when wide, polls `/api/signals` and renders the same cards — and the detail on the right. A card's "See it on the chart" stays a link to `/signals/[id]`, so the URL is always the idea on the right, back/forward work, and a shared link opens the same screen. Below 1024 both rails render nothing and fetch nothing (`usePoll` with a `null` URL pauses). Alternative: a `?selected=` query on `/` — rejected, two URLs for one idea and a detail that cannot be shared as-is.

### D3. One nav component, two positions
`BottomNav` becomes `AppNav`: the same two `Link`s with an inline-SVG icon over the label (feed: a stack of cards; trade: an up/down arrow pair), `aria-current`, 44 px minimum. Below 1024 it is `fixed bottom-0` with `bg-bg` (opaque — the `backdrop-blur` over `bg-bg/95` was what bled the cards through in the review) and `padding-bottom: env(safe-area-inset-bottom)`; from 1024 it is `fixed top-0` with a border below, the wordmark "Copy-Trade Lite" on the left, the tabs in the middle and a muted "play money · testnet" chip on the right. `body` gets `pb-16 lg:pb-0 lg:pt-16`. Constitution P4's check is reworded to "two tabs — bottom bar on phones, top bar on wide screens". Alternative: a sidebar — rejected, two tabs do not justify a rail and it would fight the feed's own left column.

### D4. Grids, and Trade as a trading desk
Feed and detail pages: `lg:grid lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:gap-8`, `lg:max-w-6xl` (1152 px).

Trade is different, and the first attempt proved it. With the chart inside the form and the account beside it, the yellow button measured **908 px** at 1280 × 800 — below the fold, worse than the phone. A wide trading screen is not a tall form next to a card; it is a desk. So `TradeScreen` now owns the selected coin and the price poll and lays out four panels in the order a person reads them — `CoinPills` across the top, the new `MarketPanel` (price hero + chart), `TradeForm` (the order ticket: Up/Down, size, button), `AccountCard` — with columns `lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]` and `xl:grid-cols-[minmax(0,1fr)_minmax(0,340px)_minmax(0,340px)]`, and no max width: a trading screen should use the window. Chart on the left, ticket beside it, account on the right is also how trading platforms lay this out, and it means **no `order` classes**: the DOM sequence is the phone's column, the wide grid's left-to-right and the tab order all at once. Measured after the change: at 1280 × 800 the button's bottom edge is 572 and the account heading 229, both well inside 800; at 375 × 812 the button is at 740, unchanged. The chart is 420 px wide-screen, 110 on a phone.

This is why the form had to be split: `TradeForm` cannot own the chart if the layout must place them in different columns. The price poll moved up to `TradeScreen` because the ticket needs the same mid for its label as the hero shows. `design.md.old` keeps the version that only measured on paper.

### D4b. One kind of yellow action, at every width
The wide feed shows the list beside the open idea, so both "See it on the chart" (per card) and "Copy this trade" would be yellow — two kinds of primary action on one screen, which constitution P1 forbids. The card's button becomes secondary from `lg` (`lg:border lg:bg-transparent lg:text-text`): with the chart already open beside the list, opening an idea is navigation, and the yellow belongs to the one thing that spends money. On a phone the card button stays yellow, because there it *is* the screen's action. Pure CSS, no prop, and it applies wherever cards appear in a wide layout.

### D5. Background and width
`body` background becomes `radial-gradient(900px 480px at 50% -120px, var(--color-surface), var(--color-bg) 70%)` over `--color-bg`: a faint glow at the top in a colour that is already in the palette (V1 keeps holding: no new hue). Content is capped at 1152 px so a 1440 px screen still reads as a designed page and not as a stretched one.

### D6. The sheet is a dialog on wide screens
`Sheet` keeps its markup; the container gets `lg:items-center` and the panel `lg:max-w-lg lg:rounded-card lg:translate-y-0` with a fade instead of the slide (`lg:opacity-0` when closed). Escape, the close control and the backdrop already work; `inert` when closed stays. Nothing changes for `PasscodeSheet` or `PostIdeaSheet`.

## Risks / Trade-offs

- [Hydration mismatch from a media query] → `useSyncExternalStore` with `getServerSnapshot: () => false`; the wide-only rails mount after hydration with a skeleton the height of the detail card, so there is no jump inside the column.
- [Two polls on the wide feed (`/api/signals` and `/api/signals/[id]`)] → they already exist on the two mobile screens; the wide layout just shows both at once. The rails pause below 1024 px.
- [The account column is taller than the window] → from `xl` it scrolls inside itself (`max-h-[calc(100dvh-9rem)] overflow-y-auto`), so the three numbers and the positions stay put while the fills list scrolls.
- [Nav icons add visual noise on phones] → 20 px line icons in the same muted/yellow colours, label kept; measured at 375 px before and after.

## Migration Plan

No data or environment changes. `BottomNav` is renamed; its two call sites (layout and tests, if any) are updated in the same change. Rollback is reverting the commit.

## Open Questions

None.
