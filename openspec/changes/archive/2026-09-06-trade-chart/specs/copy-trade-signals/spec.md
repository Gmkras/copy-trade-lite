## MODIFIED Requirements

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
