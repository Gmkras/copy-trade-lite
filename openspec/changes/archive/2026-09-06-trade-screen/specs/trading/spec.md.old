## Purpose

The HTTP contract and the Trade screen that let a non-trader pick a coin, choose Up or Down, choose how much, and place a real testnet order with one tap, while watching their account (equity, positions with PnL, open orders) update live-ish.

## ADDED Requirements

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
- **WHEN** `GET /api/price/DOGE%2FUSD` is called for a market that does not exist
- **THEN** the response is 422 with a message that the market is unknown

### Requirement: Account state is read in one call
`GET /api/account` SHALL return equity, available (withdrawable) balance, unrealized PnL, open positions (market, side, size, entry price, mark price, PnL in dollars and percent, liquidation price), open orders (market, side, size, price, time) and the last 20 fills (market, action, size, price, fee, time), fetched concurrently. An account that has not deposited yet SHALL be returned as empty (zeros and empty lists), not as an error.

#### Scenario: Funded account with a position
- **GIVEN** the account holds one BTC/USD long
- **WHEN** `GET /api/account` is called
- **THEN** `equity > 0`, `positions` has one item with `pnlUsd` equal to `(markPrice − entryPrice) × size` (sign flipped for shorts) and `fills` lists the opening fill

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
- **THEN** the response is 422 with the "between … and …" message and no transaction is sent

#### Scenario: Insufficient play money
- **GIVEN** the account has no USDC
- **WHEN** an order is posted
- **THEN** the response is 422 with a message saying to run the mint script, and `ok: false`

### Requirement: The Trade screen is one-tap simple
`/trade` SHALL show, at a 375 px viewport without scrolling for the core action: coin pills (BTC/USD selected by default), two large Up/Down buttons, a size picker with three chips and a free input that shows the market minimum, a live line "1 BTC = $…" refreshed at least every 5 s, and exactly one yellow primary button whose label states the action, the size and the approximate dollar value (e.g. "Buy 0.00002 BTC ≈ $1.60"). No trading jargon (no "long/short", "IOC", "bps", "margin") is visible.

#### Scenario: Default state
- **WHEN** the user opens `/trade`
- **THEN** BTC/USD is selected, Up is selected, the first size chip is selected, the price line shows a dollar value and the yellow button is enabled with a label naming the size and dollar value

#### Scenario: Changing side and size updates the button
- **WHEN** the user taps Down and the 0.0001 chip
- **THEN** the button reads "Sell 0.0001 BTC ≈ $…" and nothing is submitted until it is tapped

#### Scenario: Invalid typed size
- **WHEN** the user types 0 or a size above the cap in the free input
- **THEN** the button is disabled and a one-line hint states the allowed range; nothing is submitted

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
Below the form, an Account card SHALL show three big numbers (Equity, Available, PnL with green/red color), and collapsible lists of Positions (with PnL in dollars and percent), Orders and Fills, each with an inviting empty state. It SHALL poll every 5 s, keep the last good data when a refresh fails, and show a small "couldn't refresh" chip until the next success.

#### Scenario: Live values
- **GIVEN** the account holds a position
- **WHEN** the card is visible for 15 s
- **THEN** the numbers refresh at least twice and the position row shows PnL in dollars and percent with the matching color

#### Scenario: Refresh failure keeps data
- **GIVEN** the card has shown data
- **WHEN** the next refresh fails (network down)
- **THEN** the previous numbers stay visible and a "couldn't refresh" chip appears; it disappears after the next successful refresh

#### Scenario: Empty account
- **GIVEN** an account with no positions, orders or fills
- **WHEN** the card renders
- **THEN** each list shows a one-line empty state that suggests the next step (e.g. "No trades yet — try Up on BTC") instead of an empty table
