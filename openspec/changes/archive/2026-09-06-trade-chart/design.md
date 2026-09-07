## Context

`PriceChart` (dynamic, `ssr: false`) wraps `PriceChartInner`, which builds a lightweight-charts v5 candlestick chart with price lines, markers and a `ResizeObserver`, and rebuilds the whole chart when `candles`, `lines` or `markers` change. It is used by `SignalDetail` (260 px, 200 one-minute candles from `GET /api/signals/[id]`) and, since `signal-visible-in-feed`, by every `SignalCard` (170 px, 60 one-minute candles from the feed loader). `getCandles(market, minutes)` always asks the SDK for the `"1m"` interval; the SDK supports 1m … 1mo (`CandlestickInterval`). `TradeForm` owns the selected market and polls `/api/price/[market]`; the Trade screen has no chart. Constitution: one primary action per screen, yellow only for it, no jargon, 44 px tap targets, `prefers-reduced-motion` respected. See proposal.md for why.

## Goals / Non-Goals

**Goals:**
- One chart component, one toolbar, three screens; a user who learns it once knows it everywhere.
- Zoom that has somewhere to go: longer ranges fetch coarser candles instead of more minutes.
- The chart never blocks the core action: the yellow button stays visible at 375 × 812 on Trade.

**Non-Goals:**
- Streaming candles, indicators, drawings, volume; anything that turns the app into a terminal.

## Decisions

### D1. `MarketChart` = toolbar + chart in one client module
`PriceChart.tsx` / `PriceChartInner.tsx` become `MarketChart.tsx` (the `next/dynamic` wrapper, `ssr: false`, skeleton while loading) and `MarketChartInner.tsx` (toolbar and `createChart` in the same module, so the buttons can call the chart API without forwarding refs through `dynamic()`). Props: `market`, `candles` (initial data the parent already has), `lines`, `markers`, `height`, `variant: "card" | "full"`, `range` / `onRangeChange` (controlled by the parent so it can fetch), `type` / `onTypeChange`. The series is created from the type: `CandlestickSeries`, `LineSeries` (close) or `AreaSeries` (close, faint fill in the trend colour). Alternative: three components — rejected, the point is sameness.

### D2. Range → interval, one route, no polling per card
`GET /api/candles/[market]?range=` maps `1h → 1m (60)`, `4h → 5m (48)`, `1d → 15m (96)`, `1w → 1h (168)` in a pure `rangeToInterval()` (tested), validated with a zod query schema (`CandleRange = z.enum([...])`), unknown market → `UNKNOWN_MARKET` 422. `getCandles(market, { interval, count })` replaces the minutes-only signature. Who fetches: on Trade, `TradeForm` polls the route for the selected market every 15 s (a poll per screen, like the price); on the detail, `SignalDetail` fetches on range change and otherwise keeps the 200 one-minute candles it already polls; on a card, the 1h candles come from the feed loader and a longer range is a **one-off fetch on tap** (`fetchEnvelope`), stored in card state so the feed's 10-s refresh does not reset it. A card never polls on its own.

### D3. Zoom buttons act on the logical range
lightweight-charts has no `zoomIn()`. `+` and `−` take `timeScale().getVisibleLogicalRange()` and shrink or grow it by 40 % anchored on the right edge (the most recent bars), clamped to the data; reset is `fitContent()`. `handleScale` keeps `pinch`, `mouseWheel` and `axisPressedMouseMove` on; `handleScroll.vertTouchDrag` stays off so a page scroll over a card still scrolls the page. Buttons are 44 px tap targets in the toolbar, not floating over the canvas.

### D4. Chart type is a browser preference, range is per view
`localStorage` key `chart.type` (try/catch, default `candles`) so a user who prefers Line sees Line on every card, the detail and Trade. Range is local to each view (a card at 1d does not force the Trade screen to 1d) and defaults to 1h everywhere.

### D5. Card variant: quiet by default, controls on demand
`variant: "card"`: no grid, time axis kept (orientation matters once you can zoom), price axis with the last price only, level lines with their title at the **left** of the line and `axisLabelVisible: false` (the stacked "261 / 259 / 258" from the review), `scaleMargins` 0.12 / 0.12, height 170. The toolbar is one 36 px row of small chips under the chart: type (three icons with labels), range (four chips) and zoom (three buttons), all `min-h-9` on cards but `min-h-11` on full — cards are dense; the constitution's 44 px applies to the actions that matter and the chips are secondary. `variant: "full"` keeps the grid, both axes and the 44 px toolbar. Alternative: hide the toolbar on cards behind a tap — rejected, "the charts don't say they can be changed" was the complaint.

### D6. The price hero on Trade
Above the chart: "1 BTC = **$80,237**" in Space Grotesk 24 px with "+0.06% · last hour" beside it in the up/down colour, computed from the first open and last close of the visible range (pure `rangeChange(candles)`, tested). The first draft said "160 px chart, ≈ 740 by arithmetic"; the browser said 868. Ten toolbar controls do not fit one row at 375 px (they need ≈ 400 px), so the toolbar is two compact rows (28 px chips), the chart is **110 px**, the hero is one line, and the page and form gaps are 16 px. Measured: the button's bottom edge lands above the nav at 375 × 812 with a few pixels to spare — verified in the browser, not by arithmetic, and re-verified on the live URL. Below ~700 px tall the button needs a short scroll; that is accepted.

### D7. Two review fixes ride along
`CoinPills` gets a right-edge fade (`mask-image: linear-gradient(to right, black calc(100% - 24px), transparent)`) so the cut "AM…" reads as "more coins". `describe()` conjugates "think" for "You" (the default name): "You think AMZN goes down…". Both are visible in the same screens this change verifies.

## Risks / Trade-offs

- [Three interactive charts on the feed] → each is created after first paint, rebuilt only when its data changes; measured on a 375 px viewport before and after.
- [The Trade screen grows and the button drops below the fold on short phones] → chart height 160 and a measured check; if a device is shorter than 700 px the chart shrinks to 120 via a media query.
- [A range tap on a card competes with the feed poll] → the card keeps its own `override` state keyed by range; the poll only refreshes the 1h data it owns.
- [More exchange calls] → one candles call per range tap and one poll per screen on Trade; the feed loader is unchanged.

## Migration Plan

No data or environment changes. `PriceChart` is renamed; both call sites are updated in the same change. Rollback is reverting the commit.

## Open Questions

None.
