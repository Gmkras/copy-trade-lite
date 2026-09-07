# trading Specification

## Purpose

The HTTP contract and the Trade screen that let a non-trader pick a coin, choose Up or Down, choose how much, and place a real testnet order with one tap, while watching their account (equity, positions with PnL, open orders) update live-ish.

## Requirements

### Requirement: Every API response uses one envelope and readable errors
All routes under `/api` SHALL respond with `{ ok: true, data }` on success or `{ ok: false, code, message }` on failure, where `message` is plain language. Invalid input SHALL return HTTP 422, a rejected trade SHALL return 422 with the trade error code, and unexpected failures SHALL return 502 with a safe message while the detail is logged server-side. Unknown fields in a request body SHALL be rejected.

#### Scenario: Validation error
- **WHEN** `POST /api/order` receives `{ "market": "BTC/USD", "side": "up", "size": "abc" }`
- **THEN** the response is 422 with `ok: false`, a code, and a message that says the size must be a number and names the allowed range

#### Scenario: Unknown field is rejected
- **WHEN** `POST /api/order` receives a body with an extra field such as `builderFee`
- **THEN** the response is 422 and the order is not placed

#### Scenario: Upstream failure is safe
- **GIVEN** the Decibel API is unreachable
- **WHEN** any route is called
- **THEN** the response is 502 with `ok: false` and a message that the exchange could not be reached; no stack trace, key or internal URL is returned

### Requirement: Markets and prices can be listed
`GET /api/markets` SHALL return the open perp markets with name, base symbol, minimum size, size step and price step in human units, BTC/USD first. `GET /api/price/{market}` SHALL return the live mid and mark price of that market.

#### Scenario: Markets
- **WHEN** `GET /api/markets` is called
- **THEN** the first item is `BTC/USD` with `minSize` 0.00002 and every item has positive `minSize`, `sizeStep` and `priceStep`

#### Scenario: Price of an unknown market
- **WHEN** `GET /api/price/FOO%2FUSD` is called for a market that does not exist
- **THEN** the response is 422 with a message that the market is unknown

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

### Requirement: Account state is read in one call
`GET /api/account` SHALL return equity, available (withdrawable) balance, unrealized PnL, open positions (market, side, size, entry price, mark price, PnL in dollars and percent, liquidation price), open orders (market, side, size, price, time) and the last 20 fills (market, action, size, price, fee, time), fetched concurrently. An account that has not deposited yet SHALL be returned as empty (zeros and empty lists), not as an error.

#### Scenario: Funded account with a position
- **GIVEN** the account holds one BTC/USD long
- **WHEN** `GET /api/account` is called
- **THEN** `equity > 0`, `positions` has one item with `pnlUsd` equal to `(markPrice âˆ’ entryPrice) Ã— size` (sign flipped for shorts) and `fills` lists the opening fill

#### Scenario: Empty account
- **GIVEN** an account with no deposit
- **WHEN** `GET /api/account` is called
- **THEN** the response is 200 with `equity: 0` and empty `positions`, `orders` and `fills`

### Requirement: Orders are placed through one validated route
`POST /api/order` SHALL accept `{ market, side: "up" | "down", size }`, SHALL validate the body before touching the exchange, SHALL place the order through the server-side market-order function (which applies the size bounds, the builder code and the fee bound), and SHALL return the transaction hash, an explorer URL, the reference and limit prices and the size actually sent. The request SHALL NOT be able to set the builder address, the fee, the price or the time-in-force.

#### Scenario: Successful order
- **GIVEN** a funded, approved account
- **WHEN** `POST /api/order` receives `{ "market": "BTC/USD", "side": "up", "size": 0.00002 }`
- **THEN** the response is 200 with `transactionHash`, an `explorerUrl` on testnet, `referencePrice` and `limitPrice`

#### Scenario: Size above the cap
- **WHEN** the body has `size: 5`
- **THEN** the response is 422 with the "between â€¦ and â€¦" message and no transaction is sent

#### Scenario: Insufficient play money
- **GIVEN** the account has no USDC
- **WHEN** an order is posted
- **THEN** the response is 422 with a message saying to run the mint script, and `ok: false`

### Requirement: The Trade screen is one-tap simple
`/trade` SHALL show, at a 375 px viewport: coin pills (BTC/USD selected by default) whose row fades at its edge to show that it scrolls, a price hero for the selected coin ("1 BTC = $80,237" in large type with the change over the chart's visible range in the up or down colour) that follows the live stream when one is connected and a 5 s poll when it is not, the coin's chart with its controls (chart type Candles · Line · Area, range 1h · 4h · 1d · 1w, zoom − / + / reset, plus pinch and scroll zoom) that follows the coin selection, two large Up/Down buttons, a size picker with three chips and a free input that shows the market minimum, and exactly one yellow primary button whose label states the action, the size and the approximate dollar value (e.g. "Buy 0.00002 BTC ≈ $1.60"); the yellow button SHALL be visible at 375 × 812 without scrolling. The price line SHALL refresh at least every 5 s. No trading jargon (no "long/short", "IOC", "bps", "margin") is visible. When the coin's candles cannot be read the chart area SHALL say so in plain language and the rest of the screen SHALL keep working.

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

### Requirement: Placing an order shows pending, then success or a readable error
When the yellow button is tapped the screen SHALL show a pending state (button disabled with a busy label), then on success a toast with "Order sent" and a link to the explorer transaction, and the account card SHALL refresh within 10 s; on failure a toast with the server's plain-language message. A double tap SHALL never send two orders.

#### Scenario: Success path
- **GIVEN** a funded, approved account
- **WHEN** the user taps the yellow button once
- **THEN** the button shows the busy label, then a success toast with an explorer link appears and the position shows in the account card within 10 s

#### Scenario: Error path
- **GIVEN** the exchange rejects the order (for example, no play money)
- **WHEN** the user taps the yellow button
- **THEN** a toast shows the plain-language reason, the button is enabled again and no success is claimed

#### Scenario: Double tap
- **WHEN** the user taps the yellow button twice quickly
- **THEN** only one request is sent

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

#### Scenario: The stream is unavailable
- **GIVEN** the stream cannot be opened or drops
- **WHEN** the user stays on the screen
- **THEN** the card keeps updating on its timer, says so instead of claiming to be live, and nothing else changes

#### Scenario: Refresh failure keeps data
- **GIVEN** the card has shown data
- **WHEN** the next refresh fails (network down)
- **THEN** the previous numbers stay visible and a "couldn't refresh" chip appears; it disappears after the next successful refresh

#### Scenario: Empty account
- **GIVEN** an account with no positions, orders or fills
- **WHEN** the card renders
- **THEN** each list shows a one-line empty state that suggests the next step (e.g. "No trades yet â€” try Up on BTC") instead of an empty table

### Requirement: Routes that can sign a transaction are gated by a demo passcode
When `DEMO_PASSCODE` is configured, every route that can place an order or write a signal (`POST /api/order`, `POST /api/signals`, `POST /api/signals/[id]/copy`) SHALL require that value in an `x-demo-passcode` header and SHALL answer `401` with a plain-language message when it is missing or wrong, without revealing the expected value. Read-only routes SHALL remain open. When the variable is not configured, the routes SHALL behave exactly as before, so a local clone needs no code.

#### Scenario: Correct passcode
- **GIVEN** the deployment has `DEMO_PASSCODE` set and the client sends it
- **WHEN** an order is placed
- **THEN** it succeeds exactly as it does locally

#### Scenario: Missing or wrong passcode
- **GIVEN** the deployment has `DEMO_PASSCODE` set
- **WHEN** a write request arrives without the header, or with a wrong value
- **THEN** the response is `401` with a message saying a demo code is needed, the expected value is never returned, and no transaction is signed

#### Scenario: Reading needs no code
- **GIVEN** the deployment has `DEMO_PASSCODE` set
- **WHEN** the feed, a signal detail, the markets, the price or the account is requested
- **THEN** the response is normal: anyone with the link can browse

#### Scenario: Local clone without a passcode
- **GIVEN** `DEMO_PASSCODE` is not set
- **WHEN** any write request arrives
- **THEN** it is handled as before, with no header required

### Requirement: The interface asks for the demo code once
When a write is refused for a missing code, the interface SHALL ask the user for it in plain language, SHALL remember it in the browser for later writes, and SHALL let the user correct it if it is wrong. It SHALL NOT display or log the value it stores anywhere else.

#### Scenario: First write on the deployed app
- **GIVEN** the user has not entered a code
- **WHEN** they tap the primary action
- **THEN** they are asked for the demo code, and after entering the right one the action completes

#### Scenario: Wrong code
- **GIVEN** the user entered a wrong code
- **WHEN** they tap the primary action
- **THEN** they are told the code was not accepted and can type it again
