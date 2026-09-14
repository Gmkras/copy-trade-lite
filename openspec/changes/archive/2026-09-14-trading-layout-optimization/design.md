## Context

See `proposal.md` — Why. The findings come from measured screenshots of the deployment at 1440 × 900 and 375 × 812, not from reading the code.

What constrains the approach:

- **One chart component serves three screens.** `MarketChartInner.tsx` renders the feed cards (`variant="card"`), the idea detail and the Trade screen (`variant="full"`). Every change to it lands in all three, so each new feature has to be gated by variant.
- **lightweight-charts is imperative.** The chart is created inside a `useEffect` whose dependency array includes `candles`, so today every poll destroys and recreates it. Anything that must survive a data refresh (the crosshair readout, the countdown) cannot live inside that effect.
- **The level names are axis labels today.** In lightweight-charts a price line's `title` is drawn *as part of* its axis label, so it competes with the scale's own ticks. That is the cause of both label defects.
- **Server-only modules stay server-only.** `lib/decibel/*` and `lib/signals/*` are reached through their guarded `index.ts`. The two new routes are Route Handlers, so they sit on the server side of that line; nothing in this change moves an SDK call into a client component.
- **Zod schemas involved:** `CandleRange` and `CandlesQuery` already exist in `lib/schemas.ts` and are unchanged. This change adds **no request schema**, because both new routes are `GET` with no body — `apiHandler` is used without `schema`, and `/api/stats/[market]` validates its single path segment against the live market list exactly as `getPrice` does. No route in this change carries a `guard`: all of it is read-only.

## Goals / Non-Goals

**Goals:**
- A wide Trade screen whose chart is the largest element and whose viewport has no empty band.
- Chart instrumentation an experienced trader looks for first: crosshair OHLC, volume, bar countdown, controls above the canvas.
- The account's own position visible on the chart it is trading.
- The two label defects fixed by removing their cause, not by tuning pixels.
- Candles that stay readable whatever the idea's levels are.

**Non-Goals:**
- Any new dependency. Everything here is built on the lightweight-charts API already installed.
- Refactoring the chart's create/destroy lifecycle. It is a real weakness (see Risks) but it is not what this change is for, and touching it would put every screen at risk at once.
- Order book, depth, drawing tools, indicators, multiple panes beyond price + volume.
- Any change to a write path. `POST /api/order`, `POST /api/signals` and the copy route are untouched.

## Decisions

### D1 — Two read routes, not one

`GET /api/tickers` returns a light row per market (mid + 24 h change); `GET /api/stats/[market]` returns the full day for one market.

*Why two:* they have different shapes and different cadences. The pill strip needs every market at a slow cadence; the stats bar needs one market and must follow the selection immediately. One combined route would either over-fetch 36 markets' worth of statistics or force the pills to poll per market.

*Cost control:* `/api/tickers` is built from `read.markets.getAll()` + `read.marketPrices.getAll()` + `read.marketContexts.getAll()` — **three upstream calls regardless of market count**, not one per market.

*Why three and not two (corrected against live testnet in task 1.1; previous wording kept in `design.md.old`):* the two data sources key their rows differently. `marketContexts.getAll()` returns `market: "BTC/USD"` — a **name**. `marketPrices.getAll()` returns `market: "0x161b…0dca"` — an **address**. This is the same split `lib/decibel/stream.ts` already handles for the WebSocket, and the same resolution applies: `markets.getAll()` provides the `market_addr → market_name` map, and a price row whose address is not in the map is dropped rather than shown as a hash. Observed on testnet: 75 rows from each source, BTC/USD present in both once the addresses are resolved, `marketContexts` carrying `volume_24h`, `open_interest`, `previous_day_price` and `price_change_pct_24h`.

*Alternative rejected:* extending `GET /api/price/[market]`. It is used by the price poll on a 5 s cadence; hanging a 24 h candle fetch off it would triple that route's upstream cost for data that changes once a minute.

### D2 — 24 h high and low come from candles, not from a statistics endpoint

The SDK exposes no 24 h high/low. `/api/stats/[market]` derives them from `getCandles(market, { interval: "15m", count: 96 })` — exactly 24 hours — inside a `Promise.allSettled` beside the other two reads. If that call fails, `high24h` and `low24h` are `null` and the row still answers `200`.

*Why not omit them:* high and low are two of the five figures a trader reads first. Deriving them is honest as long as `null` is shown as "—" and never as `0`.

### D3 — Level names move from the price axis to a caption

Every price line becomes `axisLabelVisible: true, title: ""`, and the names are rendered as a caption row under the chart with a colour swatch each — the pattern `SignalDetail.tsx` already uses.

*Why:* it removes the cause of two defects at once. The axis stops holding two kinds of label, so a level can no longer collide with a scale tick; and the whole `LABEL_GAP` collision machinery (about 20 lines) is deleted rather than tuned. Trading terminals label levels beside the chart for the same reason.

*Alternative rejected:* keeping the titles and widening the collision rule to include the scale's ticks. The tick positions are not exposed by the library, so it would be guesswork against an internal layout.

### D4 — Copy markers lose their text; the caption names the copiers

`SeriesMarker.text` is dropped. The marker stays an arrow on its bar; the caption lists "Ben, Cid copied" and "3 copied".

*Why:* the observed `u copied` is marker text clipped at the plot's left edge. lightweight-charts offers no horizontal alignment for marker text, so any text on a marker near an edge can clip. Removing the text removes the whole class of defect; the information moves somewhere with room for it.

### D5 — Autoscale includes a level only when it is close enough to the candles

Today `autoscaleInfoProvider` folds **every** level into the visible range, which is what flattens a card whose stop loss is 50 % away. New rule: let `span = hi - lo` over the visible candles; a level is folded in only when it lies within `lo - 1.5·span` … `hi + 1.5·span`. Levels outside are excluded from the scale, not drawn, and reported in the caption as "above the chart" / "below the chart" with their price.

*Why 1.5:* it keeps the common case (TP/SL a few percent away) fully visible while refusing the pathological one. The constant lives in `lib/charts.ts` with its own unit test, so it is a named decision rather than a magic number in a component.

*Alternative rejected:* a logarithmic price scale. It keeps everything on screen but makes equal percentage moves look unequal in a product aimed at a first-time visitor.

**Correction found while implementing D8 (`design.md.old3` kept).** D5 and D8 pull against each other: the rule above excludes far levels, but your own position's entry is exactly the far level you came to see. Making the entry exempt was tried and **measured as its own defect** — forcing an entry from eight days ago onto an hour of candles took their drawn height from 250 px to **72 px** of a 420 px chart, trading one unreadable chart for another.

The rule that survives is conditional, not absolute: a level may be `pinned`, and a pinned level joins the scale **only while the candles keep at least `MIN_CANDLE_SHARE` (0.4) of it**. Past that it goes to the caption like any other far level. Observed on the Trade screen with a position entered at $79,889: on the 1 h range the entry is 3× the candles' span away, so it is captioned as "above the chart" and the candles keep 250 px; on the 1 w range, where the entry genuinely belongs, both the entry and the liquidation are drawn and the candles still keep 238 px. The entry price is on screen either way — the range decides whether the chart or the caption carries it. Only the entry is pinned; liquidation, which can sit 50 % away, follows the plain rule.

### D6 — Crosshair readout and countdown live outside the chart's effect

Both are React state in `MarketChartInner`, fed by `chart.subscribeCrosshairMove` registered inside the existing effect and by a 1 s interval in an effect of its own. The readout renders as a DOM overlay above the canvas, not as a chart primitive.

*Why:* the chart effect re-runs on every candle refresh. Keeping the readout as chart state would reset it on each poll, so the reading under the user's pointer would flicker. As DOM state it survives, and when the pointer is away it falls back to the last bar.

*Countdown source:* `rangeToInterval(range).intervalMs` already gives the bar length; the next close is `lastCandle.t + intervalMs`. A pure `countdownLabel(msLeft)` in `lib/charts.ts` does the formatting and is unit-tested; the component only holds the tick.

### D7 — Volume is a second series on its own price scale

`HistogramSeries` with `priceScaleId: "volume"` and `scaleMargins: { top: 0.8, bottom: 0 }`, coloured by the bar's direction at 40 % opacity, added only when `variant === "full"`.

*Why a separate scale:* on the price scale, volume figures in the tens of thousands would crush the price series into a line. A dedicated scale confined to the lower 20 % is how every terminal does it. Cards skip it: at 170 px tall there is no room, and the card's job is the shape of the idea, not the tape.

### D8 — The position line is passed in as data, not read by the chart

`TradeScreen` already polls the account. It selects the position whose `market` matches the selection and passes `lines` to `MarketPanel` exactly as `SignalCard` passes the idea's levels. The chart component learns nothing new.

*Why:* the chart stays a pure renderer of "candles plus lines", which is what lets one component serve three screens. Liquidation is included only when finite and greater than zero — the SDK reports `0` for a position that cannot be liquidated at current leverage, and drawing a line at `$0` would be worse than drawing none.

### D9 — The wide layout is a height-constrained grid, verified by measurement

At `lg:` the page becomes `h-[calc(100dvh-4rem)]` with `grid-rows-[auto_minmax(0,1fr)_auto]` and `min-h-0` on the scrolling children. The chart column gets `flex-1` and its pixel height is handed to the chart through the existing `height` prop via a `ResizeObserver`, since lightweight-charts needs a number.

*Why `100dvh` and not `100vh`:* mobile browsers' URL bar makes `vh` unstable; `dvh` is already used in `globals.css`.

*Verification, not arithmetic:* the previous wide layout was reasoned to be "about 740 px tall" and measured 908. Every task in this change that claims a layout outcome is verified with `getBoundingClientRect` in a real browser at 1440 × 900 and 375 × 812, and the number goes in the task. Arithmetic is not evidence.

### D10 — The bottom panel reuses the account row renderers

`PositionsPanel` is a new client component that takes the same `AccountState` and renders the same `Row` markup as `AccountCard`, switched by tabs. The row renderers move to a small shared module so there is one implementation of "a position row".

*Why not one component with a `layout` prop:* the two differ in more than layout — the accordion is three open-able sections, the panel is three mutually exclusive tabs with one always open. A shared prop would be a conditional in every branch. Sharing the rows and not the container keeps both readable.

*Which renders where:* `useMediaQuery(WIDE)` decides, because the DOM itself must differ (tabs versus sections), which is exactly the case that hook documents as its reason to exist.

### D11 — The button verb follows the direction

`TradeForm`'s `verb` becomes `side === "up" ? "Go Up" : "Go Down"`.

*Why:* the screen's vocabulary is Up/Down everywhere else; "Buy"/"Sell" was the one place the jargon leaked back in. The spec's jargon list gains "buy/sell" so the walkthrough catches a regression.

## Risks / Trade-offs

- **The chart is rebuilt on every candle refresh, and this change adds more work to each rebuild (volume series, crosshair subscription).** → **Measured, and the original mitigation was wrong — corrected here, `design.md.old2` kept.** On `/trade` at 1440 × 900, over 120 s of steady state (8 candle polls), the page produced **2 long tasks: 50 ms and 59 ms**; over a separate 60 s window, 1 of 52 ms. So roughly a quarter of rebuilds cross 50 ms, with a worst observed cost of 59 ms — about four frames, during which the chart is not interactive.

  The mitigation this document originally named — "the volume series moves behind a check that skips it when the data is unchanged" — **cannot work**, because the effect destroys and recreates the whole chart whenever `candles` changes, so at the moment volume is added its data is *always* new. Skipping it there is unreachable. The only real fix is to stop rebuilding: create the chart once and call `series.setData` / `series.update` on refresh. That is the lifecycle refactor this change lists as a **Non-Goal**, because it touches the one component all three screens share and would put the feed, the detail and the Trade screen at risk in a change whose purpose is layout.

  So the accepted position is explicit rather than implied: a 50–59 ms hitch every 15 s is shipped knowingly, it is stated in the README's "what's next" as a known weakness with these numbers, and the refactor is the first thing to do next. Two cheap reductions were considered and rejected as half-measures that would complicate the component without removing the rebuild: memoising the series data, and skipping the rebuild when only the last candle changed.
- **Two new upstream routes add load to the exchange.** → Both are `GET`, both use `getAll` calls that are constant in market count, and the stats bar polls at 30 s, six times slower than the price. Net new upstream traffic is roughly one call every 10 s per viewer.
- **`marketContexts.getAll()` is an SDK surface this project has not used before.** → It is read-only and wrapped in `Promise.allSettled`; if it fails, `changePct24h` is `null`, pills show the price alone and the stats bar shows "—". The first task verifies it against the live testnet and records the observed shape, before any UI depends on it.
- **A height-constrained grid can clip content on short viewports** (a 1024 × 600 laptop). → The wide layout is gated on `min-width: 1024px` **and** `min-height: 700px`; below that the page falls back to the stacked column, which scrolls. Verified at 1024 × 640.
- **Excluding a far level from the scale means the user cannot see it on the chart at all.** → That is the deliberate trade: the caption states the level and its price, and the idea's own text already says the percentage. A chart where the candles are a flat line communicates strictly less.
- **Removing marker text loses per-marker identity at a glance.** → The caption carries the same names, and the markers remain positioned in time. On a card there are no markers at all.
