# copy-trade-signals Specification

## Purpose

Trade ideas as first-class objects: an author posts one with entry at the live price, take-profit and stop-loss percentages and a hold duration; everyone sees it on a chart; one tap copies it into the copier's own testnet account with the builder code; every idea and copy is persisted so an author's track record can be judged over time.

## Requirements

### Requirement: Signals and copies are stored durably
The system SHALL store every posted signal and every copy in a SQL database identified by `DATABASE_URL`, creating the schema on first use, and SHALL read them back after the process restarts or is redeployed. Locally the URL SHALL default to a file in `data/`, which is excluded from version control; in a deployment it SHALL point at a remote database and MAY require `DATABASE_AUTH_TOKEN`. No signal data SHALL be committed to the repository.

#### Scenario: Restart keeps history
- **GIVEN** two signals have been posted
- **WHEN** the server is restarted and `GET /api/signals` is called
- **THEN** both signals are returned with their copies and counts

#### Scenario: First use creates the schema
- **GIVEN** an empty database
- **WHEN** the first signal is posted
- **THEN** the tables are created and the signal is stored; no manual migration step is needed

#### Scenario: Redeploy keeps history
- **GIVEN** the app is deployed with a remote `DATABASE_URL` and signals exist
- **WHEN** a new version is deployed
- **THEN** the feed still lists those signals with their copies

#### Scenario: Unreachable database
- **GIVEN** `DATABASE_URL` points at a database that cannot be reached
- **WHEN** the feed is opened
- **THEN** the screen explains in plain language that the ideas could not be loaded, and no stack trace or connection string is shown

### Requirement: Signal authoring uses the live price as entry
`POST /api/signals` SHALL accept `{ author, market, side, tpPct, slPct, holdHours, size, note? }` and SHALL set the entry price from the live mid read on the server, never from the client. It SHALL compute the take-profit and stop-loss prices from the percentages (long: TP above entry, SL below; short: mirrored), SHALL reject percentages outside 0–100, hold durations outside 1–720 hours, sizes the trade screen would reject, and unknown fields, and SHALL return the stored signal with an `expiresAt` timestamp equal to creation time plus the hold duration.

#### Scenario: Post an Up idea
- **GIVEN** BTC/USD mid is about $80,000
- **WHEN** `POST /api/signals` receives `{ author: "Ana", market: "BTC/USD", side: "up", tpPct: 3, slPct: 2, holdHours: 4, size: 0.00002 }`
- **THEN** the response is 200 with `entryPrice` ≈ 80,000, `tpPrice` ≈ 82,400, `slPrice` ≈ 78,400, `expiresAt` 4 hours after `createdAt`, and `copyCount: 0`

#### Scenario: Down idea mirrors the sides
- **WHEN** the same body has `side: "down"`
- **THEN** `tpPrice` is below the entry and `slPrice` is above it

#### Scenario: Invalid percentages, duration or size
- **WHEN** the body has `tpPct: 0`, `slPct: 150`, `holdHours: 0`, `holdHours: 1000`, `size: 5` or an extra field such as `entryPrice: 1`
- **THEN** each request is rejected with 422 and a plain-language message; nothing is stored

#### Scenario: Exchange unavailable
- **GIVEN** the live price cannot be read
- **WHEN** a signal is posted
- **THEN** the response is 502 or 422 with a readable message and nothing is stored

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

### Requirement: One tap copies a signal into the copier's account
`POST /api/signals/{id}/copy` SHALL accept `{ copier, size? }`, SHALL reject expired signals, SHALL default the size to the author's, SHALL place the equivalent market order through the same validated order path as the trade screen (same size bounds, builder code and fee bound) with the signal's take-profit and stop-loss attached when the exchange accepts them, SHALL record the copy with the transaction hash and reference price, and SHALL return the receipt and the updated copy count. If recording the copy fails after the order was placed, the response SHALL still report the order as placed and the failure SHALL be logged loudly.

#### Scenario: Successful copy
- **GIVEN** a funded, approved account and a live Up signal on BTC/USD
- **WHEN** `POST /api/signals/{id}/copy` receives `{ copier: "Ben" }`
- **THEN** the response is 200 with a transaction hash visible on the explorer, the copy appears in `GET /api/signals/{id}` and `copyCount` increments

#### Scenario: Expired signal
- **GIVEN** a signal whose hold duration has passed
- **WHEN** a copy is requested
- **THEN** the response is 422 with a message that the idea has expired and no order is placed

#### Scenario: Size above the cap
- **WHEN** the copy body has `size: 5`
- **THEN** the response is 422 with the allowed range and no order is placed

#### Scenario: Exchange rejects the order
- **GIVEN** the account has no play money
- **WHEN** a copy is requested
- **THEN** the response is 422 with the plain-language reason and nothing is recorded

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

### Requirement: The feed shows ideas as cards with one Copy action
The home screen SHALL list signals as cards that a first-time visitor can read without tapping: the author's initial and name with "12m ago" and the author's summary, a headline that states the direction in words and colour ("BTC goes up ↑" in the up colour, "goes down ↓" in the down colour), a chart of the coin's own price — the same chart component as the detail and the Trade screen — with the idea drawn over it as price lines for Entry (yellow), Take profit (green) and Stop loss (red), always inside the chart's range, the live price labelled on the price axis, a compact toolbar (chart type, range 1h · 4h · 1d · 1w, zoom − / + / reset) whose longer ranges load more history on demand, and one plain sentence about where the price is now, the TP and SL percentages, "copied N×", whether the idea is still live or expired, and a yellow button "See it on the chart" that opens the detail. When the coin's candles are unavailable the card SHALL instead draw a strip — Stop loss at one end, Entry between, Take profit at the other end, each with its price — with the same marker and sentence; when the live price is unavailable the card SHALL still draw the three levels and say the price could not be read. A card SHALL never fail to render because a fetch failed. It SHALL offer a "Post an idea" action that opens a bottom sheet form with market, Up/Down, TP %, SL %, hold hours, size, optional note and the author's name, showing the live entry price read-only and the TP/SL previews in dollars. The feed SHALL have an inviting empty state.

#### Scenario: Card draws the idea
- **GIVEN** a live Up idea on BTC/USD with entry $80,000, take profit $82,400 and stop loss $78,400, and a live mid of $80,600
- **WHEN** the user opens `/` at 375 px
- **THEN** the card shows "BTC goes up ↑" in the up colour, the BTC candles of the last hour with lines labelled Take profit, Entry and Stop loss at $82,400, $80,000 and $78,400, the last price on the axis, and the sentence "now $80,600 · on its way to the take profit"

#### Scenario: Each coin draws its own chart
- **GIVEN** live ideas on BTC/USD and AMZN/USD
- **WHEN** the feed is shown
- **THEN** the BTC card shows BTC candles and the AMZN card AMZN candles, each with its own levels and live price, and pinching or scrolling on a card's chart zooms that chart

#### Scenario: More history on a card
- **WHEN** the user taps 1d on a card's toolbar
- **THEN** that card alone loads and shows the last day of 15-minute candles with the same three lines; the other cards do not change, and the feed's refresh does not reset the chosen range

#### Scenario: Down idea reads the same way
- **GIVEN** a live Down idea whose take profit is below the entry
- **WHEN** the card is shown
- **THEN** the headline says "goes down ↓" in the down colour, the Take profit line sits below the Entry line and the Stop loss line above it on the chart, and the sentence says the price is on its way to the take profit as the price falls

#### Scenario: Candles unavailable in the feed
- **GIVEN** the candles of the idea's market cannot be read but its live price can
- **WHEN** the card is shown
- **THEN** the card draws the strip — Stop loss on the left, Entry between, Take profit on the right, each with its price — with the "now" marker and the sentence; the button still opens the detail

#### Scenario: Price unavailable in the feed
- **GIVEN** neither the live price nor the candles of the idea's market can be read
- **WHEN** the card is shown
- **THEN** the strip draws the three levels without a "now" marker and the sentence says the live price could not be read; the button still opens the detail

#### Scenario: The button says where it goes
- **WHEN** the user taps "See it on the chart" on a live card
- **THEN** the detail opens with the chart; an expired card shows "See how it went" instead

#### Scenario: Empty feed
- **GIVEN** no signals exist
- **WHEN** the user opens `/`
- **THEN** the screen says "No ideas yet — post the first one" with the Post an idea action visible

#### Scenario: Post from the sheet
- **WHEN** the user opens Post an idea, keeps BTC and Up, enters TP 3, SL 2, hold 4, size 0.00002 and a name, and taps Post
- **THEN** the sheet closes, a success toast appears and the new card is at the top of the feed

#### Scenario: Preview follows the inputs
- **WHEN** the user changes TP from 3 to 5 in the sheet
- **THEN** the take-profit preview in dollars updates without submitting anything

### Requirement: The detail screen makes the idea obvious on a chart
`/signals/{id}` SHALL show the signal's market on the same chart component as the feed and the Trade screen, with horizontal lines for Entry (yellow), Take profit (green) and Stop loss (red), the full toolbar (chart type, range 1h · 4h · 1d · 1w, zoom − / + / reset), one marker per cluster of copies made within ten minutes of each other (naming the copiers, or counting them when there are more than two) placed so it does not cover the level labels, a one-sentence plain-language description ("Ana thinks BTC goes up: in at $80,000, out at $82,400 or $78,400, for 4 hours"; "You think …" when the author is "You"), a size field defaulting to the author's size, and exactly one yellow button "Copy this trade" with pending, success (toast with explorer link) and error states. Expired ideas SHALL show the button disabled with "This idea has expired".

#### Scenario: Chart lines and marker
- **GIVEN** a live signal with one copy
- **WHEN** the user opens its detail at 375 px
- **THEN** the chart renders with three labeled lines at the entry, TP and SL prices and one marker at the copy time

#### Scenario: Copies close in time
- **GIVEN** Ben and Cid copied the idea nine minutes apart, and Dee, Eve and Fay within one minute half an hour later
- **WHEN** the detail is opened
- **THEN** the chart shows one marker "Ben, Cid copied" at Ben's minute and one marker "3 copied" at Dee's; no labels overlap

#### Scenario: Wider range on the detail
- **WHEN** the user taps 1w on the detail's toolbar
- **THEN** the chart shows the last week of hourly candles with the same three lines and the copy markers still at their times

#### Scenario: Copy from the detail
- **WHEN** the user taps Copy this trade once
- **THEN** the button shows a busy label, then a success toast with an explorer link appears, a new marker is added and the copy count increases

#### Scenario: Expired idea
- **GIVEN** an expired signal
- **WHEN** its detail is opened
- **THEN** the button is disabled and reads that the idea has expired; the chart still shows the lines
