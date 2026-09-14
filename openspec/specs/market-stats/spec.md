# market-stats Specification

## Purpose

Read-only 24-hour context for the markets this app trades — change, high, low, volume, open interest and funding — so a price can be judged against its day instead of being shown as a bare number.

## Requirements

### Requirement: One call returns a ticker row for every market
`GET /api/tickers` SHALL answer with one row per open market, each carrying the market name, its short symbol, the live mid and the 24-hour change as a percentage, using the app's standard envelope. It SHALL be read-only, need no demo passcode and accept no input. It SHALL cost a constant number of upstream calls regardless of how many markets exist. A market whose mid or change cannot be read SHALL be returned with that field `null` rather than omitted, so the list of markets never changes shape because a quote failed.

#### Scenario: Every open market is quoted
- **WHEN** `GET /api/tickers` is called
- **THEN** the response is `200` with `ok: true` and one row per market returned by `GET /api/markets`, each with `market`, `symbol`, `mid` and `changePct24h`

#### Scenario: A market cannot be quoted
- **GIVEN** the exchange returns no price for one market
- **WHEN** the route answers
- **THEN** that market's row is present with `mid: null`, every other row carries its number, and the status is still `200`

#### Scenario: The exchange is unreachable
- **WHEN** the upstream call fails entirely
- **THEN** the response is `502` with `ok: false` and a plain-language message that names no host, key or stack

### Requirement: One call returns the day's statistics for one market
`GET /api/stats/{market}` SHALL answer with the 24-hour change percentage, the 24-hour high and low, the 24-hour volume, the open interest, the funding rate in basis points with its sign and its period, for the named market. It SHALL be read-only and need no demo passcode. An unknown market SHALL be refused before the exchange is asked. A statistic the exchange does not provide SHALL be `null`, never zero or invented.

#### Scenario: Statistics for a known market
- **WHEN** `GET /api/stats/BTC%2FUSD` is called
- **THEN** the response is `200` with `changePct24h`, `high24h`, `low24h`, `volume24h`, `openInterest`, `fundingRateBps`, `isFundingPositive` and `fundingPeriodS`, and `high24h` is greater than or equal to `low24h`

#### Scenario: Unknown market
- **WHEN** `GET /api/stats/NOPE%2FUSD` is called
- **THEN** the response is `422` with `ok: false` and a message naming the unknown market, and no upstream price call is made

#### Scenario: A statistic is missing
- **GIVEN** the exchange returns no 24-hour candles for the market
- **WHEN** the route answers
- **THEN** `high24h` and `low24h` are `null`, the other statistics carry their values, and the status is `200`
