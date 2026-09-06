## Purpose

The application shell: a validated, testnet-only environment, the visual foundation (tokens, fonts, base components), and the navigation frame that every trading and copy-trade screen is mounted into.

## ADDED Requirements

### Requirement: Environment is validated before the app serves anything
The system SHALL validate its environment configuration at startup and SHALL refuse to serve any page or route while the configuration is invalid, printing one plain-language message that names the offending variable and what is expected. Required variables: `PRIVATE_KEY`, `APTOS_NODE_API_KEY`, `BUILDER_ADDRESS`, `BUILDER_FEE_BPS`, `DECIBEL_NETWORK`. Optional with defaults: `MAX_ORDER_SIZE` (0.01), `DB_PATH` (`./data/signals.db`).

#### Scenario: Valid configuration
- **GIVEN** a `.env` file with all required variables, `DECIBEL_NETWORK=testnet` and `BUILDER_FEE_BPS=10`
- **WHEN** the developer runs `pnpm dev` and opens `http://localhost:3000`
- **THEN** the home page renders

#### Scenario: Network is not testnet
- **GIVEN** `DECIBEL_NETWORK=mainnet` (or any value other than `testnet`)
- **WHEN** the app starts or the first request arrives
- **THEN** the app does not render any page and the terminal shows a message stating that only `testnet` is allowed

#### Scenario: Builder fee above the protocol cap
- **GIVEN** `BUILDER_FEE_BPS=11`
- **WHEN** the app starts
- **THEN** the app refuses to run and the message says the fee must be between 0 and 10 basis points

#### Scenario: Missing secret
- **GIVEN** `PRIVATE_KEY` is empty or absent
- **WHEN** the app starts
- **THEN** the app refuses to run and the message names `PRIVATE_KEY` and points to `.env.example`, without printing any secret value

### Requirement: Secrets never reach the browser
The system SHALL read secrets only in server-side modules. No variable containing a secret SHALL be exposed with a public prefix, and the client bundle SHALL NOT contain the private key or the API key.

#### Scenario: Client bundle inspection
- **GIVEN** a production build
- **WHEN** the built client assets are searched for the values of `PRIVATE_KEY` and `APTOS_NODE_API_KEY`
- **THEN** no match is found

#### Scenario: Client component imports the environment module
- **GIVEN** a component marked `"use client"` that imports the environment module
- **WHEN** the project is built
- **THEN** the build fails with an error rather than shipping the module to the browser

### Requirement: Environment template documents every variable
The repository SHALL include an `.env.example` file listing every variable the app reads, each with a comment stating its purpose, an example format, and where to obtain it. The file SHALL contain no real secret.

#### Scenario: New developer setup
- **GIVEN** a fresh clone
- **WHEN** the developer copies `.env.example` to `.env` and fills in the three secrets following the comments
- **THEN** `pnpm dev` starts without further configuration

### Requirement: Visual foundation follows the constitution
The UI SHALL use a black background (`#0B0B0C`), Decibel yellow (`#F5C400`) as the only strong accent, green (`#22C55E`) and red (`#EF4444`) reserved for gains/losses and direction, Inter for body text, and Space Grotesk for headlines and large numbers. Body text SHALL be at least 16 px and tap targets at least 44 px.

#### Scenario: Placeholder home
- **WHEN** a user opens `/` at a 375 px viewport
- **THEN** the page shows a black background with a yellow "Copy-Trade Lite" headline in Space Grotesk and no other saturated color

### Requirement: Base components are available and consistent
The system SHALL provide four reusable components: a full-width primary button with a pending state, a card surface, a bottom sheet that opens over the current screen and closes with a tap outside or a close control, and a toast that shows a short message and dismisses itself.

#### Scenario: Button pending state
- **GIVEN** a primary button in its pending state
- **WHEN** the user taps it
- **THEN** no action fires and the button visibly indicates it is busy

#### Scenario: Bottom sheet on mobile
- **GIVEN** a 375 px viewport
- **WHEN** a sheet is opened
- **THEN** it slides up from the bottom, covers at most the lower part of the screen, and closes when the user taps the dimmed area

#### Scenario: Toast dismissal
- **WHEN** a toast is shown
- **THEN** it is readable for at least 4 seconds and then disappears on its own

### Requirement: Two-tab navigation
The app SHALL show a bottom navigation bar with exactly two tabs, "Feed" (`/`) and "Trade" (`/trade`), on every screen. The active tab SHALL be highlighted in yellow.

#### Scenario: Switching tabs
- **GIVEN** the user is on `/`
- **WHEN** they tap "Trade"
- **THEN** the URL changes to `/trade`, the Trade tab is highlighted, and the Feed tab is not

#### Scenario: Route not yet built
- **GIVEN** the Trade screen has not been implemented yet
- **WHEN** the user opens `/trade`
- **THEN** a placeholder page states in plain language that this screen is coming, instead of a 404

### Requirement: Project is 100% TypeScript with strict checks
All source files SHALL be TypeScript (`.ts`/`.tsx`) compiled with `strict: true`, and the repository SHALL provide `typecheck`, `lint`, `test`, `dev` and `build` scripts.

#### Scenario: Type check passes
- **WHEN** the developer runs `pnpm typecheck`
- **THEN** it exits with code 0

#### Scenario: No JavaScript source
- **WHEN** the developer lists tracked files matching `*.js` or `*.jsx` outside generated config
- **THEN** none are found
