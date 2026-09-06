## Purpose

Authenticated, testnet-only access to the Decibel exchange from the server: building the trading client from the validated environment, reading markets, prices and account state, funding the test account, approving the builder fee once, and placing a market order with a builder code under strict safety bounds.

## ADDED Requirements

### Requirement: Trading client is built once from the validated environment
The system SHALL build the Decibel read and write clients from the validated environment exactly once per process, using the testnet configuration only, the Geomi API key for every request, the account derived from `PRIVATE_KEY`, that account's primary subaccount address for all account reads, and the builder address left-padded to 64 hex characters.

#### Scenario: Client resolves addresses from the key
- **GIVEN** a valid `.env`
- **WHEN** the client is created
- **THEN** it exposes the wallet address derived from `PRIVATE_KEY`, the primary subaccount address derived from that wallet, and a builder address of exactly `0x` + 64 hex characters

#### Scenario: Only testnet configuration is used
- **GIVEN** the codebase
- **WHEN** it is searched for network configuration
- **THEN** the only Decibel configuration referenced is the testnet one and the fullnode/trading URLs used at runtime are testnet URLs

### Requirement: Live market data and account state can be read
The system SHALL read the list of perp markets (name, address, price and size decimals, tick size, lot size, minimum size), the live mid price of a market, and the account overview (equity, withdrawable balance, unrealized PnL), open positions, open orders and recent fills for the primary subaccount.

#### Scenario: BTC/USD market and price
- **GIVEN** a valid `.env` with a working API key
- **WHEN** markets and the BTC/USD price are requested
- **THEN** a market named `BTC/USD` is returned with its precision fields and a positive mid price is returned for it

#### Scenario: Empty account
- **GIVEN** an account with no deposits, positions or orders
- **WHEN** account state is requested
- **THEN** equity is reported as 0 and positions, orders and fills are reported as empty lists, without any error

#### Scenario: Rejected API key
- **GIVEN** an invalid `APTOS_NODE_API_KEY`
- **WHEN** any read is performed
- **THEN** the operation fails with a message stating that the API key was rejected and where to get one, and no secret is printed

### Requirement: Human amounts are converted to chain units safely
The system SHALL convert human-readable prices and sizes to integer chain units using the market's decimals, rounding prices to the market tick size, flooring sizes to the market lot size, and SHALL reject sizes that are not finite, are not positive, are below the market minimum, or exceed `MAX_ORDER_SIZE`, with a message that states the allowed range.

#### Scenario: Valid size is floored to the lot
- **GIVEN** a market with 3 size decimals, lot size 1 and minimum size 1 (chain units) and `MAX_ORDER_SIZE = 0.01`
- **WHEN** a size of 0.0015 is converted
- **THEN** the result is 1 chain unit (0.001) and no error is raised

#### Scenario: Invalid sizes are rejected before any network call
- **GIVEN** the same market
- **WHEN** a size of 0, a negative size, `NaN`, 0.0004 (below minimum) or 0.02 (above the cap) is converted
- **THEN** each conversion fails with a plain-language message naming the allowed range, and no request is sent

#### Scenario: Price rounds to the tick
- **GIVEN** a market with 6 price decimals and tick size 100000 (chain units, i.e. 0.1)
- **WHEN** a price of 64123.456 is converted
- **THEN** the result is 64123500000 chain units (64123.5)

### Requirement: Builder fee approval is an explicit one-time step
The system SHALL provide a script that approves the configured builder address for a maximum fee equal to `BUILDER_FEE_BPS` on the primary subaccount, SHALL refuse to approve more than 10 basis points, and SHALL be safe to run more than once.

#### Scenario: Approval succeeds
- **GIVEN** a funded testnet account and `BUILDER_FEE_BPS=10`
- **WHEN** the approve script runs
- **THEN** it submits one transaction, prints its hash and the approved fee, and exits 0

#### Scenario: Approval re-run
- **GIVEN** the approval already exists
- **WHEN** the approve script runs again
- **THEN** it either succeeds again or reports that the approval is already in place; it never fails with a stack trace

#### Scenario: No gas
- **GIVEN** a wallet with no APT
- **WHEN** the approve script runs
- **THEN** it exits non-zero with a message that the wallet needs testnet APT and the faucet URL

### Requirement: Market orders carry the builder code and respect the fee bound
The system SHALL place perp orders as immediate-or-cancel limit orders priced 0.5 % through the live mid in the order's direction, SHALL attach the configured builder address, SHALL use `BUILDER_FEE_BPS` as the order fee, and SHALL assert immediately before signing that this fee does not exceed the approved maximum and does not exceed 10 basis points. When take-profit and stop-loss prices are supplied they SHALL be on the correct side of the entry (long: TP above, SL below; short: TP below, SL above) or the order SHALL be rejected before signing.

#### Scenario: Minimum BTC/USD order succeeds
- **GIVEN** a funded, approved account
- **WHEN** a market buy of the minimum BTC/USD size is placed
- **THEN** the result contains a transaction hash visible on the Aptos testnet explorer, the reference price used, and the order id when available

#### Scenario: Fee above the approved bound
- **GIVEN** the code is modified so the fee constant exceeds the approved maximum
- **WHEN** an order is placed
- **THEN** it is rejected before any transaction is built, with a message naming the bound

#### Scenario: TP/SL on the wrong side
- **GIVEN** a long order with a stop-loss above the entry price
- **WHEN** the order is placed
- **THEN** it is rejected before signing with a message explaining which side the stop-loss must be on

#### Scenario: Insufficient balance
- **GIVEN** an account with no USDC deposited
- **WHEN** an order is placed
- **THEN** the operation fails with a plain-language message that the account needs more play money and how to mint it, and no success is reported

#### Scenario: SDK reports failure
- **GIVEN** the SDK returns a non-success result or throws
- **WHEN** an order is placed
- **THEN** the failure is surfaced as a typed error with a readable message; a success is never reported without a transaction hash

### Requirement: Test funds can be obtained with scripts
The system SHALL provide scripts to generate a new testnet account (printing only its address and the key format expected in `.env`), and to mint test USDC through the testnet-only faucet function and deposit it into the primary subaccount, reporting how much was minted and the remaining allowance.

#### Scenario: Mint and deposit
- **GIVEN** a wallet with APT and remaining mint allowance
- **WHEN** the mint script runs
- **THEN** it mints the requested amount (default 1,000 USDC), deposits it, prints both transaction hashes and the new equity, and exits 0

#### Scenario: Mint allowance exhausted
- **GIVEN** the daily mint allowance for the account is used up
- **WHEN** the mint script runs
- **THEN** it exits non-zero with a message stating the allowance is exhausted and when it resets, without attempting the transaction

### Requirement: A smoke check proves the connection end to end
The system SHALL provide a script that prints the wallet address, the primary subaccount address, the open perp markets, the BTC/USD mid price and the account equity, exits 0 on success and non-zero with a single plain-language message on any failure, and never prints secrets.

#### Scenario: Smoke passes
- **GIVEN** a valid `.env`
- **WHEN** the smoke script runs
- **THEN** it prints the five items above with real values and exits 0

#### Scenario: Smoke fails clearly
- **GIVEN** the network is unreachable or the key is rejected
- **WHEN** the smoke script runs
- **THEN** it exits non-zero, prints one readable reason and no stack trace by default, and prints no secret
