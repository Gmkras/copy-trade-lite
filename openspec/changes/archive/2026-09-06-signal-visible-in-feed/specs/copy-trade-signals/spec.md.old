## MODIFIED Requirements

### Requirement: Signals can be listed and opened
`GET /api/signals` SHALL return signals newest first with author, market, side, entry/TP/SL prices and percentages, size, note, creation and expiry times, copy count, a per-author summary (ideas posted, copies received), and the live mid price of every market that has at least one live signal, keyed by market. A market whose price cannot be read SHALL be omitted from the prices without failing the request. `GET /api/signals/{id}` SHALL return the signal, its copies (copier, size, fill price, transaction hash, time), the live mid price, and the last 200 one-minute candles of its market for charting.

#### Scenario: Feed order and counts
- **GIVEN** signals A (older, copied twice) and B (newer, never copied)
- **WHEN** `GET /api/signals` is called
- **THEN** B comes first, A shows `copyCount: 2`, and the author summary of A's author counts 1 idea and 2 copies

#### Scenario: Feed carries live prices
- **GIVEN** live signals on BTC/USD and ETH/USD and an expired one on AMZN/USD
- **WHEN** `GET /api/signals` is called
- **THEN** the response includes a positive live price for BTC/USD and ETH/USD; AMZN/USD is not requested

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

### Requirement: The feed shows ideas as cards with one Copy action
The home screen SHALL list signals as cards that a first-time visitor can read without tapping: the author's initial and name with "12m ago" and the author's summary, a headline that states the direction in words and colour ("BTC goes up ↑" in the up colour, "goes down ↓" in the down colour), a horizontal strip that draws the idea — Stop loss at one end, Entry between, Take profit at the other end, each with its price — with a marker at the market's live price and one plain sentence about where the price is now, the TP and SL percentages, "copied N×", whether the idea is still live or expired, and a yellow button "See it on the chart" that opens the detail. When the live price is unavailable the strip SHALL still draw the three levels and say the price could not be read. It SHALL offer a "Post an idea" action that opens a bottom sheet form with market, Up/Down, TP %, SL %, hold hours, size, optional note and the author's name, showing the live entry price read-only and the TP/SL previews in dollars. The feed SHALL have an inviting empty state.

#### Scenario: Card draws the idea
- **GIVEN** a live Up idea on BTC/USD with entry $80,000, take profit $82,400 and stop loss $78,400, and a live mid of $80,600
- **WHEN** the user opens `/` at 375 px
- **THEN** the card shows "BTC goes up ↑" in the up colour, a strip with Stop loss $78,400 on the left, Entry $80,000 between and Take profit $82,400 on the right, a "now" marker a quarter of the way from the entry to the take profit, and the sentence "now $80,600 · on its way to the take profit"

#### Scenario: Down idea reads the same way
- **GIVEN** a live Down idea whose take profit is below the entry
- **WHEN** the card is shown
- **THEN** the headline says "goes down ↓" in the down colour, the stop loss is still on the left and the take profit on the right, and the "now" marker moves right as the price falls toward the take profit

#### Scenario: Price unavailable in the feed
- **GIVEN** the live price of the idea's market cannot be read
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
`/signals/{id}` SHALL show a candlestick chart of the signal's market with horizontal lines for Entry (yellow), Take profit (green) and Stop loss (red), one marker per minute in which copies happened (naming the copiers, or counting them when there are more than two), a one-sentence plain-language description ("Ana thinks BTC goes up: in at $80,000, out at $82,400 or $78,400, for 4 hours"), a size field defaulting to the author's size, and exactly one yellow button "Copy this trade" with pending, success (toast with explorer link) and error states. Expired ideas SHALL show the button disabled with "This idea has expired".

#### Scenario: Chart lines and marker
- **GIVEN** a live signal with one copy
- **WHEN** the user opens its detail at 375 px
- **THEN** the chart renders with three labeled lines at the entry, TP and SL prices and one marker at the copy time

#### Scenario: Copies in the same minute
- **GIVEN** Ben and Cid copied the idea within the same minute, and Dee, Eve and Fay within another
- **WHEN** the detail is opened
- **THEN** the chart shows one marker "Ben, Cid copied" for the first minute and one marker "3 copied" for the second; no labels overlap

#### Scenario: Copy from the detail
- **WHEN** the user taps Copy this trade once
- **THEN** the button shows a busy label, then a success toast with an explorer link appears, a new marker is added and the copy count increases

#### Scenario: Expired idea
- **GIVEN** an expired signal
- **WHEN** its detail is opened
- **THEN** the button is disabled and reads that the idea has expired; the chart still shows the lines
