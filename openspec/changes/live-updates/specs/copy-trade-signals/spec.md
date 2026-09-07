## ADDED Requirements

### Requirement: The feed follows the live prices and settles without waiting
When the live stream is connected, each card's "now" marker, its price sentence and its progress SHALL follow the streamed price of its market instead of the price captured by the last feed load. When a streamed price reaches an open idea's take-profit or stop-loss level, the interface SHALL refresh the feed at once so that idea is settled and its result shown within about a second, instead of on the next scheduled refresh. The interface SHALL never decide an outcome by itself: it asks the server to refresh, and the outcome is still settled from the market's candles on the server, so what is shown and what is stored can never disagree. When the stream is not connected the feed SHALL keep refreshing on its timer exactly as before.

#### Scenario: The marker moves on its own
- **GIVEN** the stream is connected and a live BTC idea is on screen
- **WHEN** the market moves
- **THEN** the card's "now" price and its sentence change without a page refresh and without a feed request

#### Scenario: A crossing settles the idea at once
- **GIVEN** an open Up idea with a take profit at $82,400 and the stream connected
- **WHEN** a streamed price reaches $82,400
- **THEN** the feed is refreshed immediately and the card shows its result within about a second, with the outcome the server settled from the candles

#### Scenario: The browser never invents the outcome
- **GIVEN** a streamed price that crossed a level
- **WHEN** the server's settlement decides otherwise (for example, the candle also crossed the stop loss)
- **THEN** the card shows what the server stored, not what the price suggested

#### Scenario: Without the stream nothing changes
- **GIVEN** the stream cannot be opened
- **WHEN** the user watches the feed
- **THEN** prices and outcomes keep arriving on the existing 10-second refresh and the screen says it is refreshing on a timer
