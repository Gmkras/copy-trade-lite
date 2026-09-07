## Why

The reviewer's first screen on the public URL is the feed, and it is the one screen that needs no tap and no code. Today it shows an idea as text, two percentage pills and a yellow button labelled **Copy**; the chart the brief asks for (SHOULD 6, "so the trade is obvious") only appears after tapping that button, whose label promises a trade rather than a chart. A reviewer who browses without tapping never sees the idea visualised — which is exactly the observation we received ("I think you missed *visualise a signal on the chart*"). The brief's own bar is "a smart 12-year-old could use it"; a card a child can read at a glance is the fix, and it is small.

**Tier served:** SHOULD 6 (visualise the signal) and the product rule "genuinely simple UI".

## What Changes

- **Every card draws the idea.** A compact strip under the headline shows Stop loss on the left, Entry in the middle, Take profit on the right, and a **"now" marker at the live price**, with one plain sentence ("now $79,855 · on its way to the take profit"). No candles are fetched for the feed; the strip is drawn from the three prices the card already has plus the market's live mid.
- **The feed carries live prices.** `GET /api/signals` and the server-rendered feed include the live mid of every market that has a live idea (a handful of markets, one price call each, failures tolerated: the strip then shows no "now" marker and says so). The route and the page share one loader instead of duplicating the read.
- **The card's direction is a picture, not a pill.** The headline becomes "BTC goes up ↑" in green (or "goes down ↓" in red) so the direction is readable before any word.
- **The card button says where it goes.** "See it on the chart" instead of "Copy"; the one-tap copy stays on the detail, where the brief puts it. Expired cards keep "See how it went".
- **Copies in the same minute share one chart marker** ("Ben, Cid copied" or "3 copied") instead of overlapping labels — a defect seen on the deployed chart.
- README and the status table say where the visualisation lives (feed strip + detail chart).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `copy-trade-signals`: the feed-card requirement gains the visual strip, the live "now" marker, the direction headline and the new button label; the listing requirement gains live prices in the feed response; the detail-chart requirement groups same-minute copies into one marker.

## Non-goals

- No sparkline or candles in the feed (one chart per screen is enough, and it would multiply the exchange calls per poll).
- No change to authoring, copying, the order path or the passcode.
- No new colours or components beyond one small SVG strip.

## Impact

- `lib/signals/math.ts` (pure strip geometry + marker grouping, tested), `lib/signals/feed.ts` (new shared loader), `lib/decibel/markets.ts` (`getPrices` for several markets), `lib/schemas.ts` (`SignalList.prices`).
- `components/SignalCard.tsx`, new `components/IdeaStrip.tsx`, `components/SignalDetail.tsx` (marker grouping), `app/page.tsx` and `app/api/signals/route.ts` (use the loader).
- No new dependencies. The feed poll makes one extra price call per distinct market every 10 s.
