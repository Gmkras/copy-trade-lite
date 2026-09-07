## ADDED Requirements

### Requirement: Candles can be read per market and range
`GET /api/candles/{market}?range=1h|4h|1d|1w` SHALL return the market's candles for that range, at the interval that fits it (1h → 1-minute, 4h → 5-minute, 1d → 15-minute, 1w → 1-hour), ascending, with open/high/low/close/volume and millisecond timestamps, together with the range and interval used. The default range SHALL be 1h. An unknown market or an unknown range SHALL be rejected with 422 and a plain-language message.

#### Scenario: One hour of minutes
- **WHEN** `GET /api/candles/BTC%2FUSD?range=1h` is called
- **THEN** the response is 200 with about 60 ascending candles at a 1-minute interval and `interval: "1m"`

#### Scenario: A week of hours
- **WHEN** `GET /api/candles/BTC%2FUSD?range=1w` is called
- **THEN** the response is 200 with about 168 candles at a 1-hour interval

#### Scenario: Unknown market or range
- **WHEN** `GET /api/candles/FOO%2FUSD?range=1h` or `GET /api/candles/BTC%2FUSD?range=3y` is called
- **THEN** the response is 422 with a message naming the problem; nothing else is returned

## MODIFIED Requirements

### Requirement: The Trade screen is one-tap simple
`/trade` SHALL show, at a 375 px viewport: coin pills (BTC/USD selected by default) whose row fades at its edge to show that it scrolls, a price hero for the selected coin ("1 BTC = $80,237" in large type with the change over the chart's visible range in the up or down colour), the coin's chart with its controls (chart type Candles · Line · Area, range 1h · 4h · 1d · 1w, zoom − / + / reset, plus pinch and scroll zoom) that follows the coin selection, two large Up/Down buttons, a size picker with three chips and a free input that shows the market minimum, and exactly one yellow primary button whose label states the action, the size and the approximate dollar value (e.g. "Buy 0.00002 BTC ≈ $1.60"); the yellow button SHALL be visible at 375 × 812 without scrolling. The price line SHALL refresh at least every 5 s. No trading jargon (no "long/short", "IOC", "bps", "margin") is visible. When the coin's candles cannot be read the chart area SHALL say so in plain language and the rest of the screen SHALL keep working.

#### Scenario: Default state
- **WHEN** the user opens `/trade`
- **THEN** BTC/USD is selected, Up is selected, the first size chip is selected, the price hero shows a dollar value, the BTC chart renders with Candles and 1h selected, and the yellow button is enabled with a label naming the size and dollar value, all visible at 375 × 812 without scrolling

#### Scenario: Changing side and size updates the button
- **WHEN** the user taps Down and the 0.0001 chip
- **THEN** the button reads "Sell 0.0001 BTC ≈ $…" and nothing is submitted until it is tapped

#### Scenario: Invalid typed size
- **WHEN** the user types 0 or a size above the cap in the free input
- **THEN** the button is disabled and a one-line hint states the allowed range; nothing is submitted

#### Scenario: The chart follows the coin
- **WHEN** the user taps the ETH pill
- **THEN** the hero and the chart switch to ETH/USD within a moment, with the same chart type and range the user had chosen

#### Scenario: Chart type and range
- **WHEN** the user taps Line and then 1d
- **THEN** the chart redraws as a line over the last day (15-minute points) and the hero's change figure is measured over that day; the type stays Line after a reload

#### Scenario: Zoom
- **WHEN** the user taps + twice, then reset
- **THEN** the visible range narrows to the most recent part of the data each time, and reset shows the whole range again; pinching or scrolling on the chart zooms as well

#### Scenario: Candles unavailable
- **GIVEN** the exchange does not return candles for the selected coin
- **WHEN** the screen renders
- **THEN** the chart area reads "No price history for ETH right now" and the price line, the form and the yellow button keep working
