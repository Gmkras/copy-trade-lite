## Why

A review of the deployed app at 1440 × 900 found the chart occupying roughly 11 % of the viewport with a black band below the fold, no 24 h statistics, an open BTC position whose entry is invisible on the Trade chart, a clipped marker label (`u copied`), a level label colliding with an axis tick, and a card whose candles collapse into a flat line when the stop loss is far away. Together they read as "not built by someone who trades". Serves the STRETCH tier (layout and polish); MUST and SHOULD behaviour is untouched.

## What Changes

- **Full-height trading desk.** At ≥ lg the Trade screen fills the viewport: coin strip on top, chart column that grows to the available height, order ticket and account numbers in a right rail, and a tabbed Positions / Open orders / Fills panel under the chart. The phone column is unchanged apart from a taller chart.
- **24 h statistics bar** above the chart: change, high, low, volume, open interest and funding — from a new read route.
- **Coin pills carry price and 24 h change**, so the strip becomes a market map instead of a row of tickers.
- **Chart becomes an instrument**: toolbar above the canvas, crosshair OHLC readout, volume histogram, and a countdown to the current candle's close.
- **Your position is drawn on the Trade chart** (entry and, when known, liquidation).
- **Level names move from the price axis to a caption legend**, which removes the axis collision; copy markers lose their text, which removes the clipping. Levels far outside the visible range no longer flatten the series — they are excluded from autoscale and reported in the caption as off-chart.
- **Feed cards keep only the range chips**; chart type and zoom stay on the full-size charts.
- **The order button's verb matches the direction chosen** (Up → "Go Up", Down → "Go Down") instead of Buy/Sell.

## Capabilities

### New Capabilities
- `market-stats`: 24 h context (change, high, low, volume, open interest, funding) per market and a light ticker list for every market, as read-only routes.

### Modified Capabilities
- `trading`: the Trade screen's layout, the chart's instrumentation, and the account panel's shape at wide widths.
- `copy-trade-signals`: how an idea's levels are labelled on the chart, and the controls a feed card carries.

## Non-goals

No new trading features, no order types, no depth or order book, no drawing tools, no TradingView Advanced Charts licence, no change to the order, copy or settlement paths, and no change to any route that signs.

## Impact

`components/` (MarketChartInner, MarketPanel, TradeScreen, CoinPills, AccountCard, SignalCard, SignalDetail, TradeForm) plus a new `MarketStatsBar` and `PositionsPanel`; `lib/charts.ts`, `lib/schemas.ts`, `lib/decibel/markets.ts`; new `app/api/tickers` and `app/api/stats/[market]` routes. No dependency added, no write path touched.
