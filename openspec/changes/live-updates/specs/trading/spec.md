## ADDED Requirements

### Requirement: The server streams live market and account events
`GET /api/stream` SHALL answer with a Server-Sent Events stream carrying, as they happen: a `price` event per market update with the market name and its mid and mark prices, and an `account` event whenever the trading account's overview, positions, open orders or fills change. The `account` event SHALL carry no account data — it is a signal to refresh — so the stream never exposes anything a read route does not already expose. The route SHALL be readable without the demo passcode, like every other read route, and SHALL never accept input that reaches the exchange.

The stream SHALL open the exchange subscriptions once per server instance and share them with every connected viewer, closing them when the last viewer disconnects. It SHALL end itself before the hosting platform's request limit and tell the browser when to come back, so a viewer's connection is renewed without any visible interruption.

#### Scenario: Prices arrive as they happen
- **WHEN** a client opens `GET /api/stream` and BTC/USD trades
- **THEN** the client receives `price` events for BTC/USD with a positive mid, without polling

#### Scenario: An account change is announced, not sent
- **GIVEN** a client connected to the stream
- **WHEN** an order of the shared testnet account fills
- **THEN** the client receives an `account` event whose payload contains no balances, positions or addresses

#### Scenario: One upstream subscription for many viewers
- **GIVEN** three clients connected to the same server instance
- **WHEN** the exchange publishes a price
- **THEN** all three receive it and the server holds one set of exchange subscriptions, released when the third disconnects

#### Scenario: The stream renews itself
- **GIVEN** a client connected for longer than the platform allows a single request to run
- **WHEN** the route ends the stream
- **THEN** the browser reconnects on its own and keeps receiving events; no error is shown

#### Scenario: Reading the stream needs no code
- **GIVEN** a deployment with `DEMO_PASSCODE` set
- **WHEN** `GET /api/stream` is requested without the header
- **THEN** the stream opens normally

## MODIFIED Requirements

### Requirement: The account card is live-ish and honest about staleness
Below the form, an Account card SHALL show three big numbers (Equity, Available, PnL with green/red color), and collapsible lists of Positions (with PnL in dollars and percent), Orders and Fills, each with an inviting empty state. It SHALL follow the live stream when one is connected, refreshing within a second of an account event, and SHALL poll every 5 s when it is not. It SHALL keep the last good data when a refresh fails and show a small "couldn't refresh" chip until the next success. The card SHALL say in plain words whether it is live or refreshing on a timer, and SHALL never claim to be live while the stream is down.

#### Scenario: Live values
- **GIVEN** the account holds a position
- **WHEN** the card is visible for 15 s
- **THEN** the numbers refresh at least twice and the position row shows PnL in dollars and percent with the matching color

#### Scenario: An order updates the card at once
- **GIVEN** the card is connected to the stream
- **WHEN** an order of the shared account fills
- **THEN** the numbers and the position list update within about a second, without waiting for the next poll

#### Scenario: Refresh failure keeps data
- **GIVEN** the card has shown data
- **WHEN** the next refresh fails (network down)
- **THEN** the previous numbers stay visible and a "couldn't refresh" chip appears; it disappears after the next successful refresh

#### Scenario: The stream is unavailable
- **GIVEN** the stream cannot be opened or drops
- **WHEN** the user stays on the screen
- **THEN** the card keeps updating on its timer, says so instead of claiming to be live, and nothing else changes

#### Scenario: Empty account
- **GIVEN** an account with no positions, orders or fills
- **WHEN** the card renders
- **THEN** each list shows a one-line empty state that suggests the next step (e.g. "No trades yet — try Up on BTC") instead of an empty table

### Requirement: The Trade screen is one-tap simple
`/trade` SHALL show, at a 375 px viewport: coin pills (BTC/USD selected by default) whose row fades at its edge to show that it scrolls, a price hero for the selected coin ("1 BTC = $80,237" in large type with the change over the chart's visible range in the up or down colour) that follows the live stream when one is connected and a 5 s poll when it is not, the coin's chart with its controls (chart type Candles · Line · Area, range 1h · 4h · 1d · 1w, zoom − / + / reset, plus pinch and scroll zoom) that follows the coin selection, two large Up/Down buttons, a size picker with three chips and a free input that shows the market minimum, and exactly one yellow primary button whose label states the action, the size and the approximate dollar value (e.g. "Buy 0.00002 BTC ≈ $1.60"); the yellow button SHALL be visible at 375 × 812 without scrolling. No trading jargon (no "long/short", "IOC", "bps", "margin") is visible. When the coin's candles cannot be read the chart area SHALL say so in plain language and the rest of the screen SHALL keep working.

#### Scenario: Default state
- **WHEN** the user opens `/trade`
- **THEN** BTC/USD is selected, Up is selected, the first size chip is selected, the price hero shows a dollar value, the BTC chart renders with Candles and 1h selected, and the yellow button is enabled with a label naming the size and dollar value, all visible at 375 × 812 without scrolling

#### Scenario: The price moves on its own
- **GIVEN** the stream is connected and BTC/USD is selected
- **WHEN** the market moves
- **THEN** the hero's price changes without a page refresh and the button's dollar estimate follows it

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
