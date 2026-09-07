## MODIFIED Requirements

### Requirement: Visual foundation holds on every screen
The UI SHALL use a black background (`#0B0B0C`, which MAY carry a subtle radial gradient toward `#141416` in the same palette), Decibel yellow (`#F5C400`) as the only strong accent, green (`#22C55E`) and red (`#EF4444`) reserved for gains/losses and direction, Inter for body text, and Space Grotesk for headlines and large numbers. Body text SHALL be at least 16 px and tap targets at least 44 px. Below 1024 px every screen SHALL be a single column designed for 375 px. From 1024 px the core screens SHALL use the width, never exceeding 1152 px of content: the feed SHALL show the list of ideas beside the full chart and copy panel of one idea (the newest live idea on `/`, the opened idea on `/signals/{id}`), and the Trade screen SHALL show the form beside the account card, with the coin's chart taller than on a phone. The same routes SHALL serve both layouts; no data SHALL be fetched for a column that is not shown.

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
- **WHEN** a user opens `/trade` at 1280 px
- **THEN** the form (coin, price, chart of at least 240 px, Up/Down, size, yellow button) is on the left and the account card on the right, both visible without scrolling at 1280 × 800

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
