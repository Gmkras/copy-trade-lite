## MODIFIED Requirements

### Requirement: Visual foundation holds on every screen
The UI SHALL use a black background (`#0B0B0C`, which MAY carry a subtle radial gradient toward `#141416` in the same palette), Decibel yellow (`#F5C400`) as the only strong accent, green (`#22C55E`) and red (`#EF4444`) reserved for gains/losses and direction, Inter for body text, and Space Grotesk for headlines and large numbers. Body text SHALL be at least 16 px and tap targets at least 44 px. Below 1024 px every screen SHALL be a single column designed for 375 px. From 1024 px the core screens SHALL use the width: the feed SHALL show the list of ideas beside the full chart and copy panel of one idea (the newest live idea on `/`, the opened idea on `/signals/{id}`) within at most 1152 px of content, and the Trade screen SHALL lay its four panels out as a trading desk — the coins across the top, the coin's chart at no less than 360 px tall, the order ticket, and the account — using the full width of the window. From 1280 px the chart, the ticket and the account SHALL sit side by side with all of them visible without scrolling. The same routes SHALL serve both layouts; no data SHALL be fetched for a column that is not shown.

#### Scenario: Home screen
- **WHEN** a user opens `/` at a 375 px viewport
- **THEN** the ideas feed renders on a black background with yellow as the only strong accent, and green and red used only for direction and profit or loss

#### Scenario: Every screen keeps the palette
- **WHEN** `/trade` and `/signals/{id}` are inspected
- **THEN** each uses the same background, accent and type scale, with no other saturated color

#### Scenario: Wide feed
- **WHEN** a user opens `/` at a 1280 px viewport with two live ideas
- **THEN** the ideas are listed in a left column and the newest one's full chart, sentence and "Copy this trade" panel fill the right column; tapping "See it on the chart" on the other card changes the URL to its `/signals/{id}` and the right column to that idea, and the list stays on the left

#### Scenario: Wide trade
- **WHEN** a user opens `/trade` at 1280 × 800
- **THEN** the coins run across the top, the coin's chart of at least 360 px fills the left, the order ticket (Up/Down, how much, the yellow button) sits beside it and the account with its positions is on the right, and the yellow button and the account's three numbers are both visible without scrolling

#### Scenario: Trade between 1024 and 1280
- **WHEN** a user opens `/trade` at 1024 px
- **THEN** the chart and the ticket sit side by side and the account card runs full width beneath them

#### Scenario: Trade on a phone is unchanged
- **WHEN** a user opens `/trade` at 375 × 812
- **THEN** the order is coins, price and chart, Up/Down, how much, the yellow button — with the button still visible above the navigation without scrolling

#### Scenario: Phone pays nothing for the wide layout
- **WHEN** `/signals/{id}` is opened at 375 px
- **THEN** no request for the ideas list is made; the screen is the single-column detail as before

### Requirement: Base components are available and consistent
The system SHALL provide four reusable components: a full-width primary button with a pending state, a card surface, a sheet that opens over the current screen and closes with a tap outside or a close control — sliding up from the bottom on phones and appearing as a centered dialog from 1024 px — and a toast that shows a short message and dismisses itself.

#### Scenario: Button pending state
- **GIVEN** a primary button in its pending state
- **WHEN** the user taps it
- **THEN** no action fires and the button visibly indicates it is busy

#### Scenario: Bottom sheet on mobile
- **GIVEN** a 375 px viewport
- **WHEN** a sheet is opened
- **THEN** it slides up from the bottom, covers at most the lower part of the screen, and closes when the user taps the dimmed area

#### Scenario: Sheet on a wide screen
- **GIVEN** a 1280 px viewport
- **WHEN** "Post an idea" is opened
- **THEN** the same form appears as a centered dialog no wider than 512 px over a dimmed page, and closes with Escape, the close control or a tap on the dimmed area

#### Scenario: Toast dismissal
- **WHEN** a toast is shown
- **THEN** it is readable for at least 4 seconds and then disappears on its own

### Requirement: Every screen passes the simplicity walkthrough
Each screen of the app SHALL have exactly one yellow primary action, SHALL use plain language with no exchange jargon ("long", "short", "IOC", "bps", "margin", "leverage", "reduce-only"), SHALL give every number a unit or a comparison, and SHALL show an inviting next step instead of an empty area when it has no data. A list MAY repeat the screen's primary action once per item. Where a wide layout shows a list beside the item it opens, the list's action SHALL be secondary, so the screen still has exactly one kind of yellow action.

#### Scenario: One primary action per screen
- **WHEN** each of `/`, `/trade` and `/signals/{id}` is inspected at a 375 px viewport
- **THEN** exactly one element uses the yellow primary style as the screen's main action

#### Scenario: One primary action on a wide screen
- **WHEN** `/` is inspected at 1280 px, with the list of ideas beside the open one
- **THEN** the only yellow action is "Copy this trade"; the cards' "See it on the chart" is an outlined, secondary control

#### Scenario: No jargon anywhere
- **WHEN** the visible text of each screen is searched for exchange jargon
- **THEN** no match is found

#### Scenario: Empty areas invite
- **GIVEN** no signals, no positions, no orders and no fills
- **WHEN** the feed and the account card render
- **THEN** each empty list shows a sentence that names the next step

### Requirement: Two-tab navigation between built screens
The app SHALL show a navigation bar with exactly two tabs, "Feed" (`/`) and "Trade" (`/trade`), each with an icon and its label, on every screen: a bottom bar below 1024 px, opaque, with padding for the device's bottom safe area; a top bar from 1024 px carrying the app's wordmark and a "play money · testnet" note. The active tab SHALL be highlighted in yellow, both tabs SHALL lead to a working screen, and every tab SHALL be at least 44 px tall.

#### Scenario: Switching tabs
- **GIVEN** the user is on `/`
- **WHEN** they tap "Trade"
- **THEN** the URL changes to `/trade`, the Trade tab is highlighted, and the Feed tab is not

#### Scenario: Both tabs lead to a built screen
- **WHEN** the user opens each tab in turn
- **THEN** `/` shows the ideas feed and `/trade` shows the trade screen; neither is a placeholder and neither is a 404

#### Scenario: Bar position follows the viewport
- **WHEN** the viewport is 375 px wide and then 1280 px wide
- **THEN** the same two tabs sit in an opaque bar at the bottom, then in a bar at the top with the wordmark; nothing beneath the bar shows through in either case
