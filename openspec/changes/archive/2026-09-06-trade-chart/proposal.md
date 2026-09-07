## Why

The Trade screen is the only screen without a chart: a reviewer picks a coin, sees "1 BTC = $80,237" as a line of text and is asked to tap Buy blind. And the charts we do have (feed cards, detail) are read-only in practice: the user reported that pinching a card "barely zooms" — there are only sixty one-minute candles to zoom into — and that "nothing on the chart says it can be changed". The brief wants a genuinely simple UI, not a static one: a TradingView-style chart people recognise, with the few controls they expect (chart type, time range, zoom), the same everywhere.

**Tier served:** MUST 3 (the trade screen) and SHOULD 6 (the chart), plus the "mobile-friendly" STRETCH; this is polish of the demo path, which the brief says reviewers run first.

## What Changes

- **One chart component with a toolbar, used in all three views.** Chart type (Candles · Line · Area), time range (1h · 4h · 1d · 1w) and zoom (pinch/scroll plus − / + / reset buttons). The choice of type is remembered in the browser. Feed cards get the compact toolbar; the detail and the Trade screen get the full one.
- **A candles route per market and range**: `GET /api/candles/{market}?range=1h|4h|1d|1w` returns candles at the interval that fits the range (1m, 5m, 15m, 1h), so a longer range is more history, not more points.
- **The Trade screen gets a price hero and the chart of the selected coin** between the coin pills and the Up/Down buttons: the price in large type with the change over the visible range in green/red, and the chart underneath. It follows the coin selection.
- **Chart polish everywhere**: thousands separators on the price axis, level labels that never stack on the axis, top/bottom margins so no axis label is clipped, no grid on cards, copy markers that do not overlap labels.
- **Two small fixes seen in the review**: the coin row fades at its edge to show it scrolls; "You thinks" becomes "You think" in the idea sentence.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `trading`: the Trade-screen requirement gains the price hero and the chart with its controls; a new requirement covers the candles route (added to this capability because it serves the trade screen first).
- `copy-trade-signals`: the feed-card and detail-chart requirements gain the chart controls and the on-demand longer ranges.

## Non-goals

- No indicators, drawing tools, order placement from the chart, or volume pane.
- No WebSocket streaming of candles (the routes stay polled; a later change may subscribe).
- No change to how orders are placed or gated.

## Impact

- `lib/decibel/markets.ts` (`getCandles` takes an interval; `rangeToInterval`), new `app/api/candles/[market]/route.ts`, `lib/schemas.ts` (`CandleRange`, `CandlesResponse`).
- `components/PriceChart*.tsx` become `MarketChart*` with the toolbar and series types; `SignalCard`, `SignalDetail`, `TradeForm` use it; `CoinPills` gets the edge fade; `lib/signals/math.ts` (`describe` grammar).
- No new dependencies: `lightweight-charts` already ships candlestick, line and area series.
