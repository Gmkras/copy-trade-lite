## Purpose

Trade ideas as first-class objects: an author posts one with entry at the live price, take-profit and stop-loss percentages and a hold duration; everyone sees it on a chart; one tap copies it into the copier's own testnet account with the builder code; every idea and copy is persisted so an author's track record can be judged over time.

## ADDED Requirements

### Requirement: Signals are persisted locally and survive restarts
The system SHALL store every posted signal and every copy in a local SQLite database file at `DB_PATH`, creating the file and tables on first use, and SHALL read them back after the server restarts. The database file SHALL be excluded from version control.

#### Scenario: Restart keeps history
- **GIVEN** two signals have been posted
- **WHEN** the dev server is restarted and `GET /api/signals` is called
- **THEN** both signals are returned with their copies and counts

#### Scenario: First use creates the file
- **GIVEN** `data/signals.db` does not exist
- **WHEN** the first signal is posted
- **THEN** the file is created and the signal is stored; no manual migration step is needed

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
`GET /api/signals` SHALL return signals newest first with author, market, side, entry/TP/SL prices and percentages, size, note, creation and expiry times, copy count, and a per-author summary (ideas posted, copies received). `GET /api/signals/{id}` SHALL return the signal, its copies (copier, size, fill price, transaction hash, time), the live mid price, and the last 200 one-minute candles of its market for charting.

#### Scenario: Feed order and counts
- **GIVEN** signals A (older, copied twice) and B (newer, never copied)
- **WHEN** `GET /api/signals` is called
- **THEN** B comes first, A shows `copyCount: 2`, and the author summary of A's author counts 1 idea and 2 copies

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

### Requirement: The feed shows ideas as cards with one Copy action
The home screen SHALL list signals as cards showing the author's initial and name, "went Up/Down on BTC · 12m ago", the TP and SL percentages, "copied N×", whether the idea is still live or expired, and a yellow Copy button that opens the detail. It SHALL offer a "Post an idea" action that opens a bottom sheet form with market, Up/Down, TP %, SL %, hold hours, size, optional note and the author's name, showing the live entry price read-only and the TP/SL previews in dollars. The feed SHALL have an inviting empty state.

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
`/signals/{id}` SHALL show a candlestick chart of the signal's market with horizontal lines for Entry (yellow), Take profit (green) and Stop loss (red), markers at the times of copies, a one-sentence plain-language description ("Ana thinks BTC goes up: in at $80,000, out at $82,400 or $78,400, for 4 hours"), a size field defaulting to the author's size, and exactly one yellow button "Copy this trade" with pending, success (toast with explorer link) and error states. Expired ideas SHALL show the button disabled with "This idea has expired".

#### Scenario: Chart lines and marker
- **GIVEN** a live signal with one copy
- **WHEN** the user opens its detail at 375 px
- **THEN** the chart renders with three labeled lines at the entry, TP and SL prices and one marker at the copy time

#### Scenario: Copy from the detail
- **WHEN** the user taps Copy this trade once
- **THEN** the button shows a busy label, then a success toast with an explorer link appears, a new marker is added and the copy count increases

#### Scenario: Expired idea
- **GIVEN** an expired signal
- **WHEN** its detail is opened
- **THEN** the button is disabled and reads that the idea has expired; the chart still shows the lines
