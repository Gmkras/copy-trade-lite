## Context

The feed is server-rendered by `app/page.tsx` (reads the repository directly, then `Feed` polls `GET /api/signals` every 10 s) and the two readers duplicate the same three lines. A card (`SignalCard`) knows the three prices of its idea but nothing about the market's current price; only the detail fetches a price and candles. The chart component snaps each copy to the candle of its minute, so two copies in one minute produce two markers at the same bar and their labels overlap (seen on the deployed chart). Constitution P1 allows a list to repeat its one primary action per item; P3 forbids jargon; V-rules fix the palette (yellow primary, `up`/`down` colours, no new saturated colours). See proposal.md for why.

## Goals / Non-Goals

**Goals:**
- A card that reads as a picture: direction, the three levels and where the price is now, with no fetch per card.
- One feed loader shared by the page and the route, so the deployed feed and the API can never disagree.
- Zero new dependencies; the strip is a few SVG lines with the existing tokens.

**Non-Goals:**
- Candles in the feed, animated strips, or per-card polling.
- Any change to what a copy does, to the chart library usage beyond the marker labels, or to the passcode.

## Decisions

### D1. The strip always puts the stop on the left and the take profit on the right
For both Up and Down ideas the strip reads left = "where the idea stops", right = "where it wins"; the direction is carried by the headline ("goes up ↑" / "goes down ↓") and its colour, not by flipping the strip. A child reads one rule: *right is good*. The position of a price on the strip is its progress from the stop to the take profit: `progress(p) = (p − sl) / (tp − sl)` for Up and `(sl − p) / (sl − tp)` for Down, clamped to 0–1, so the entry lands at `slPct / (tpPct + slPct)` and the "now" marker moves right as the idea goes well in either direction. Alternative: mirror the strip for Down ideas so it matches the chart — rejected, the chart is a price axis while the strip is a *progress* axis, and mixing the two is what confuses.

### D2. Strip geometry and wording are pure functions in `lib/signals/math.ts`
`ideaProgress(signal, now?)` returns the three positions (0–1), the "now" position or null, and a `state`: `"toward-tp"`, `"toward-sl"`, `"at-entry"` (within ±0.2 % of the entry), `"beyond-tp"`, `"beyond-sl"`, `"unknown"`. `progressSentence(signal, now?)` turns that into the one line under the strip: "now $80,600 · on its way to the take profit", "now $79,200 · slipping toward the stop loss", "now $80,010 · right at the entry", "past the take profit", "past the stop loss", "live price unavailable". Unit-tested for Up and Down, the boundaries and the null price; `SignalCard` and `IdeaStrip` only render what these return (renders stay pure, as with `now` today).

### D3. One `loadFeed()` for the page and the route, with prices and candles fetched once per market
New `lib/signals/feed.ts` (server-only through `lib/signals/index.ts`): reads signals and author stats in parallel, collects the distinct markets of the *live* signals, then fetches in parallel their mids (`getPrices`, one `markets.getAll()` for validation and one price call per market) and their last 60 one-minute candles (`getCandlesFor`, one candles call per market), both with `Promise.allSettled`, and returns `SignalList` with `prices` and `candles` keyed by market. A failed market is omitted from that map, never fatal (spec scenarios "One price unavailable", "Candles unavailable in the feed"). Expired ideas trigger no call: their card shows no "now" marker and the sentence says the idea has ended. Alternative: each card polls `/api/price/[market]` and `/api/signals/[id]` — rejected, N polls per screen for the same three markets and a card that can not be server-rendered complete.

### D4. Every card renders the real chart (`PriceChart`), with `IdeaStrip` as the fallback
The user's decision, in two steps: first "each coin with its own chart, like fomo.family", then "a TradingView chart all the time, in both views". So a card renders the same `PriceChart` (lightweight-charts v5, the detail's component) at 170 px with the coin's last hour of one-minute candles and the three price lines; no copy markers on cards. The series' own last-price line and axis label are the "now" marker, and the sentence under the chart says it in words. The y-scale always includes the three levels (`autoscaleInfoProvider`), so the idea is never off-screen. Pinch and scroll zoom come with the library; a chart-type switcher and zoom buttons are deliberately left to the Trade-screen change, where they will be built once and reused. Cost accepted knowingly: one chart instance (a handful of canvases) per card, rebuilt on each 10 s poll like the detail's; the library is already in the bundle for the detail. The previous two versions are kept: a level strip only (`design.md.old`) and a static SVG line chart (`design.md.old2`, component `IdeaChart.tsx`, deleted) — both were replaced within the hour because a reviewer expects the *chart*, not a picture of one. When a market's candles are missing the card renders `IdeaStrip` — a track with Stop loss / Entry / Take profit, their prices and the same dot and sentence, drawn from the idea alone (D1) — so a card never depends on a fetch to render.

### D5. Card layout and the button label
Row order: identity line (initial, name, time, summary) → headline in the direction colour → strip → sentence → pills and status → button. The headline moves the direction from a grey suffix to the loudest line on the card, using the existing `up`/`down` tokens. The button keeps the yellow primary (constitution P1 as amended) and reads **"See it on the chart"**: honest about what happens on tap, and it names the thing the brief asks for. "Copy" was the label a reviewer could read as "trade now" and skip. Expired: "See how it went", unchanged.

### D6. Copies close in time share a marker
`groupCopyMarkers(copies, windowMs = 10 min)` in `math.ts` sorts copies and starts a new cluster whenever a copy is ten minutes or more after the cluster's first one; a cluster is labelled "Ben copied", "Ben, Cid copied" or "3 copied" (three or more) at its first copy's minute. Per-minute grouping was the first version; on the deployed chart two copies nine minutes apart still collided, because 200 bars share ~290 px and a label is ~60 px wide, so the window is about proximity on screen, not calendar minutes. `SignalDetail` passes the grouped list to `PriceChart`; the chart component itself does not change. Tested with one, two and three copies in a minute, two copies nine minutes apart (one marker) and 25 minutes apart (two markers).

## Risks / Trade-offs

- [Two more exchange calls per distinct market on every feed poll] → the feed has a handful of markets and polls every 10 s; failures degrade per market (strip, then "price unavailable"), never to a broken feed.
- [The strip misleads when the price is far outside the range] → positions are clamped and the sentence says "past the take profit" / "past the stop loss", so the picture and the words agree.
- [An hour of price looks flat next to a ±3 % idea] → that is the honest picture: the levels are included in the scale on purpose so the idea is visible; the axis shows the real prices.
- [Several chart instances on one screen] → three to five cards at 170 px each is what a phone shows; charts are created client-side after the first paint (skeleton on the server render) and the feed poll only rebuilds the ones whose candles changed.
- [A card gets taller; fewer fit on a phone] → the chart replaces the "In at $… with …" line rather than adding to it; target is one full card plus the next card's headline visible at 375 × 812.
- [Label change surprises someone who knew "Copy"] → the detail's "Copy this trade" is unchanged and the README demo path names the new label.

## Migration Plan

No data or environment changes. Deploy is a normal push; the strip appears on the next feed load. Rollback is reverting the commit.

## Open Questions

None.
