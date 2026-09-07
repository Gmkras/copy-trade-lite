## MODIFIED Requirements

### Requirement: Environment is validated before the app serves anything
The system SHALL validate its environment configuration at startup and SHALL refuse to serve any page or route while the configuration is invalid, printing one plain-language message that names the offending variable and what is expected. Required variables: `PRIVATE_KEY`, `APTOS_NODE_API_KEY`, `BUILDER_ADDRESS`, `BUILDER_FEE_BPS`, `DECIBEL_NETWORK`. Optional with defaults: `MAX_ORDER_SIZE` (0.01), `DATABASE_URL` (`file:./data/signals.db`), `DATABASE_AUTH_TOKEN` (empty) and `DEMO_PASSCODE` (empty). `DB_PATH` is no longer read.

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

#### Scenario: No database configuration at all
- **GIVEN** `DATABASE_URL` is absent
- **WHEN** the app starts
- **THEN** it starts normally and uses the local file `data/signals.db`, so a fresh clone needs no database setup
