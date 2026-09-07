## ADDED Requirements

### Requirement: Every screen passes the simplicity walkthrough
Each screen of the app SHALL have exactly one yellow primary action, SHALL use plain language with no exchange jargon ("long", "short", "IOC", "bps", "margin", "leverage", "reduce-only"), SHALL give every number a unit or a comparison, and SHALL show an inviting next step instead of an empty area when it has no data.

#### Scenario: One primary action per screen
- **WHEN** each of `/`, `/trade` and `/signals/{id}` is inspected at a 375 px viewport
- **THEN** exactly one element uses the yellow primary style as the screen's main action

#### Scenario: No jargon anywhere
- **WHEN** the visible text of each screen is searched for exchange jargon
- **THEN** no match is found

#### Scenario: Empty areas invite
- **GIVEN** no signals, no positions, no orders and no fills
- **WHEN** the feed and the account card render
- **THEN** each empty list shows a sentence that names the next step

### Requirement: The app is usable by keyboard and respects motion preferences
Every interactive control SHALL be reachable and operable with the keyboard, SHALL show a visible focus ring, and SHALL have a tap target of at least 44 px in its smaller dimension. When the operating system asks for reduced motion, the app SHALL not animate.

#### Scenario: Keyboard focus is visible
- **WHEN** the user tabs through a screen
- **THEN** each focused control shows a yellow focus ring and the tab order follows the visual order

#### Scenario: Tap targets
- **WHEN** the interactive controls of each screen are measured at 375 px
- **THEN** every one of them is at least 44 px tall

#### Scenario: Reduced motion
- **GIVEN** the browser reports `prefers-reduced-motion: reduce`
- **WHEN** a sheet opens and a skeleton is shown
- **THEN** no transition or pulsing animation runs

### Requirement: Development-only overlays never appear over the app
The application SHALL NOT render framework development indicators or overlays on top of its own interface.

#### Scenario: No dev indicator over the navigation
- **WHEN** the app runs with `pnpm dev` at 375 px
- **THEN** no framework badge or button overlaps the bottom navigation

### Requirement: A fresh clone reaches the demo path from the README alone
Following `README.md` from a clean clone SHALL be enough to install, configure, fund and place one real testnet order, with no undocumented step.

#### Scenario: Fresh clone rehearsal
- **GIVEN** the repository cloned into an empty folder and the three credentials
- **WHEN** the README's "Run it locally" steps are followed literally
- **THEN** `pnpm smoke` succeeds and one order is placed, without needing information that is not in the README

#### Scenario: Honest status
- **WHEN** the README's status table is compared with the app
- **THEN** every feature marked done was verified, and everything not built is listed as not done
