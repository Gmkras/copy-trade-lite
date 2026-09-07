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

### D3. One `loadFeed()` for the page and the route, with prices fetched once per market
New `lib/signals/feed.ts` (server-only through `lib/signals/index.ts`): reads signals and author stats in parallel, collects the distinct markets of the *live* signals, fetches their mids with `Promise.allSettled` through a new `getPrices(marketNames)` in `lib/decibel/markets.ts` (one `markets.getAll()` for validation, then one price call per market), and returns `SignalList` with `prices: Record<string, number>`. A failed market is omitted, never fatal (spec scenario "One price unavailable"). Expired ideas do not trigger a price call: their strip shows no "now" marker and the sentence says the idea has ended. Alternative: each card polls `/api/price/[market]` — rejected, N polls per screen for the same three markets and a card that can not be server-rendered complete.

### D4. `IdeaStrip` is one small SVG, not a chart
Around 40 lines: a track, three ticks with their labels (Stop loss / Entry / Take profit and the prices, `money()` with the card's digits), the coloured segments (down-colour from stop to entry, up-colour from entry to take profit) and a yellow "now" dot with a small label. `role="img"` with an `aria-label` equal to the sentence, so a screen reader hears exactly what a sighted user reads. Alternative: a `lightweight-charts` sparkline per card — rejected (canvas per card, candles per card, ~45 KB doing a job three lines can do).

### D5. Card layout and the button label
Row order: identity line (initial, name, time, summary) → headline in the direction colour → strip → sentence → pills and status → button. The headline moves the direction from a grey suffix to the loudest line on the card, using the existing `up`/`down` tokens. The button keeps the yellow primary (constitution P1 as amended) and reads **"See it on the chart"**: honest about what happens on tap, and it names the thing the brief asks for. "Copy" was the label a reviewer could read as "trade now" and skip. Expired: "See how it went", unchanged.

### D6. Same-minute copies share a marker
`groupCopyMarkers(copies)` in `math.ts` buckets copies by `floor(createdAt / 60_000)` and labels a bucket "Ben copied", "Ben, Cid copied" or "3 copied" (three or more). `SignalDetail` passes the grouped list to `PriceChart`; the chart component itself does not change. Tested with one, two and three copies in a minute and with copies in different minutes.

## Risks / Trade-offs

- [One more exchange call per distinct market on every feed poll] → the feed has a handful of markets and polls every 10 s; failures degrade to "price unavailable" per market, never to a broken feed.
- [The strip misleads when the price is far outside the range] → positions are clamped and the sentence says "past the take profit" / "past the stop loss", so the picture and the words agree.
- [A card gets taller; fewer fit on a phone] → the strip replaces the "In at $… with …" line rather than adding to it; target is one full card plus the next card's headline visible at 375 × 812.
- [Label change surprises someone who knew "Copy"] → the detail's "Copy this trade" is unchanged and the README demo path names the new label.

## Migration Plan

No data or environment changes. Deploy is a normal push; the strip appears on the next feed load. Rollback is reverting the commit.

## Open Questions

None.
