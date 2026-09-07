## Why

The app was designed at 375 px and it shows: on a laptop it is a 448 px column in the middle of a black screen, with 70 % of the width empty, a bottom bar meant for thumbs, and a translucent nav that lets blurred content bleed through (it read as a rendering bug in the review). A reviewer who opens the link on a laptop — the most likely first visit — gets the weakest version of the product. The brief's STRETCH "mobile-friendly layout" is done; this is the other direction: the same screens using a wide viewport well, without a second design.

**Tier served:** polish of the demo path (the brief grades "genuinely simple UI" and says reviewers run the demo path first); STRETCH "mobile layout" already delivered, this makes it responsive both ways.

## What Changes

- **Two columns from 1024 px on the feed.** The list of ideas on the left and the idea's full chart with its copy panel on the right — on `/` the newest live idea, on `/signals/{id}` that idea — so browsing and copying happen on one screen.
- **Trade becomes a trading desk on wide screens**, the way people expect from a trading platform: the coins across the top, the coin's chart large on the left, the order ticket (Up/Down, how much, the one yellow button) beside it, and the account with its positions on the right — everything on one screen, no scrolling. On a phone it stays exactly as it is today: coins, price and chart, ticket, account, in one column.
- Below 1024 px nothing changes on any screen.
- **Navigation that fits the screen.** Phones keep the bottom bar, now opaque (no blur bleed), with an icon above each label and safe-area padding for iPhones; from 1024 px the same two tabs become a top bar with the app's wordmark and a "play money · testnet" chip. Still exactly two tabs, still yellow for the active one.
- **A quieter, deeper background**: a subtle radial gradient in the existing palette so the empty space on wide screens is not flat black; content width capped at 1152 px.
- **Sheets become centered dialogs on wide screens** (same component; on phones they still slide up from the bottom).
- **Trade's chart grows on wide screens** (420 px instead of 110), since the above-the-fold constraint is a phone constraint and the chart has its own column.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `app-shell`: the navigation requirement (bottom bar on phones, top bar on wide screens, icons, opaque, safe area), the visual-foundation requirement (wide layouts, content width, background), the base-components requirement (sheet as a dialog on wide screens) and the simplicity-walkthrough requirement (a list beside the item it opens uses a secondary action, so a wide screen still has one kind of yellow).

## Non-goals

- No new screens, routes or data; the two-column feed reuses the detail component and the same URLs.
- No desktop-only features (keyboard shortcuts, hover menus). Everything remains tappable.
- No change to the mobile screens beyond the nav's icons and opacity.

## Impact

- `app/layout.tsx`, `components/BottomNav.tsx` (becomes `AppNav`), `app/globals.css` (background), `components/Sheet.tsx`.
- `app/page.tsx` and `app/signals/[id]/page.tsx` gain a second column rendered by two small client components (`DetailRail`, `FeedRail`) that fetch only when the viewport is wide.
- `components/TradeScreen.tsx` takes over the selected coin and the price poll and lays out four panels; the chart moves into a new `components/MarketPanel.tsx`; `components/TradeForm.tsx` becomes the order ticket alone.
- New `hooks/useMediaQuery.ts`. `specs/constitution.md` P4 wording ("the nav has two tabs — bottom on phones, top on wide screens").
- No new dependencies.
