## ADDED Requirements

### Requirement: Ideas are settled from the price history
The system SHALL decide the outcome of every posted idea from the market's own candles between the moment it was posted and the moment it is judged, and SHALL store that outcome once. An idea SHALL be marked `tp` when the market reached its take-profit level (for an Up idea, a candle high at or above it; for a Down idea, a candle low at or below it), `sl` when it reached its stop-loss level (mirrored), and `expired` when its hold duration ended without either. When one candle reached both levels the system SHALL record `sl`, because the order of the two moves inside a candle is unknown and the conservative reading is the one that does not claim a win. An idea already carrying an outcome SHALL never be recomputed. Settlement SHALL NOT read fills or positions, so an idea nobody copied is judged by the same rule as one copied ten times.

#### Scenario: The price reaches the take profit
- **GIVEN** a live Up idea on BTC/USD with entry $80,000 and take profit $82,400
- **WHEN** a candle since it was posted has a high of $82,500 and the feed is loaded
- **THEN** the idea is stored with outcome `tp` and every screen shows it as "hit the take profit"

#### Scenario: The price reaches the stop loss
- **GIVEN** a live Down idea whose stop loss is above the entry
- **WHEN** a candle since it was posted has a high at or above that stop
- **THEN** the idea is stored with outcome `sl`

#### Scenario: The hold ends with neither level reached
- **GIVEN** an idea whose hold duration has passed and whose price stayed between the two levels
- **WHEN** the feed is loaded
- **THEN** the idea is stored with outcome `expired`

#### Scenario: One candle reached both levels
- **GIVEN** an idea and a candle whose high is above the take profit and whose low is below the stop loss
- **WHEN** the idea is settled
- **THEN** the outcome is `sl`, never `tp`

#### Scenario: A settled idea is never re-judged
- **GIVEN** an idea already marked `tp`
- **WHEN** the price later falls through its stop loss and the feed is loaded again
- **THEN** the stored outcome is still `tp` and no further candle read is made for it

#### Scenario: Candles unavailable
- **GIVEN** the exchange cannot return candles for an idea's market
- **WHEN** the feed is loaded
- **THEN** the response is still 200 with every idea, those ideas keep no outcome, the failure is logged server-side, and no error is shown to the user

#### Scenario: A settled idea cannot be copied
- **GIVEN** an idea marked `tp`, `sl` or `expired`
- **WHEN** its detail is opened
- **THEN** the copy button is disabled and reads how the idea went, and `POST /api/signals/{id}/copy` refuses it

### Requirement: An author's record is visible, not just their volume
The per-author summary SHALL include, besides ideas posted and copies received, how many of that author's ideas have been settled and how many of those hit the take profit, and the interface SHALL show that record next to the author's name wherever the summary is shown. An author with no settled ideas SHALL show only ideas and copies, never a rate computed from nothing.

#### Scenario: An author with a record
- **GIVEN** Ana has posted 3 ideas, 2 of them settled and 1 of those a take profit
- **WHEN** the feed is loaded
- **THEN** her summary reads "3 ideas · N copies · 1 of 2 worked"

#### Scenario: An author with nothing settled yet
- **GIVEN** Ben has posted 1 idea, still live
- **WHEN** the feed is loaded
- **THEN** his summary reads "1 idea · 0 copies" with no hit rate

## MODIFIED Requirements

### Requirement: Signals can be listed and opened
`GET /api/signals` SHALL return signals newest first with author, market, side, entry/TP/SL prices and percentages, size, note, creation and expiry times, copy count, the outcome of each settled idea (`tp`, `sl`, `expired`, or none while it is still open), a per-author summary (ideas posted, copies received, ideas settled, ideas that hit the take profit), and, for every market that has at least one live signal, its live mid price and its last hour of one-minute candles, each keyed by market. A market whose price or candles cannot be read SHALL be omitted from that map without failing the request. `GET /api/signals/{id}` SHALL return the signal with its outcome, its copies (copier, size, fill price, transaction hash, time), the live mid price, and the last 200 one-minute candles of its market for charting.

#### Scenario: Feed order and counts
- **GIVEN** signals A (older, copied twice) and B (newer, never copied)
- **WHEN** `GET /api/signals` is called
- **THEN** B comes first, A shows `copyCount: 2`, and the author summary of A's author counts 1 idea and 2 copies

#### Scenario: Feed carries outcomes
- **GIVEN** one idea that hit its take profit and one still open
- **WHEN** `GET /api/signals` is called
- **THEN** the first carries `outcome: "tp"` and the second `outcome: null`, and the author summary carries the settled and won counts

#### Scenario: Feed carries live prices
- **GIVEN** live signals on BTC/USD and ETH/USD and an expired one on AMZN/USD
- **WHEN** `GET /api/signals` is called
- **THEN** the response includes a positive live price and an ascending list of about 60 one-minute candles for BTC/USD and ETH/USD; AMZN/USD is not requested

#### Scenario: One price unavailable
- **GIVEN** the exchange cannot quote ETH/USD right now
- **WHEN** `GET /api/signals` is called
- **THEN** the response is still 200 with the signals and the BTC/USD price; ETH/USD is simply absent from the prices

#### Scenario: Detail with candles
- **WHEN** `GET /api/signals/{id}` is called for a stored signal
- **THEN** the response includes the signal, its copies, a positive live price and an ascending list of candles with open/high/low/close and millisecond timestamps

#### Scenario: Unknown id
- **WHEN** `GET /api/signals/does-not-exist` is called
- **THEN** the response is 404 with a message that the idea was not found
