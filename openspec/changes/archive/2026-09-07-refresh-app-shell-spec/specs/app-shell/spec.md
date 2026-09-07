## REMOVED Requirements

### Requirement: Visual foundation follows the constitution
**Reason**: Its only scenario, "Placeholder home", describes a screen that no longer exists — the home became the ideas feed in `copy-trade-signals`. A MODIFIED block cannot retire a scenario (validation refuses to drop one), so the requirement is replaced by "Visual foundation holds on every screen" below, which keeps every guarantee and describes the shipped app.
**Migration**: None. The successor requirement carries the same tokens, fonts, minimum text size and tap-target rule; only the scenario changed.

### Requirement: Two-tab navigation
**Reason**: Its "Route not yet built" scenario describes `/trade` as a placeholder, which stopped being true in `trade-screen`. Replaced by "Two-tab navigation between built screens" below, which keeps the surviving scenario and states what the tabs do today.
**Migration**: None. The successor requirement keeps the two-tab bottom navigation and the yellow active tab exactly as they are.

## ADDED Requirements

### Requirement: Visual foundation holds on every screen
The UI SHALL use a black background (`#0B0B0C`), Decibel yellow (`#F5C400`) as the only strong accent, green (`#22C55E`) and red (`#EF4444`) reserved for gains/losses and direction, Inter for body text, and Space Grotesk for headlines and large numbers. Body text SHALL be at least 16 px and tap targets at least 44 px.

#### Scenario: Home screen
- **WHEN** a user opens `/` at a 375 px viewport
- **THEN** the ideas feed renders on a black background with yellow as the only strong accent, and green and red used only for direction and profit or loss

#### Scenario: Every screen keeps the palette
- **WHEN** `/trade` and `/signals/{id}` are inspected
- **THEN** each uses the same background, accent and type scale, with no other saturated color

### Requirement: Two-tab navigation between built screens
The app SHALL show a bottom navigation bar with exactly two tabs, "Feed" (`/`) and "Trade" (`/trade`), on every screen. The active tab SHALL be highlighted in yellow, and both tabs SHALL lead to a working screen.

#### Scenario: Switching tabs
- **GIVEN** the user is on `/`
- **WHEN** they tap "Trade"
- **THEN** the URL changes to `/trade`, the Trade tab is highlighted, and the Feed tab is not

#### Scenario: Both tabs lead to a built screen
- **WHEN** the user opens each tab in turn
- **THEN** `/` shows the ideas feed and `/trade` shows the trade screen; neither is a placeholder and neither is a 404
