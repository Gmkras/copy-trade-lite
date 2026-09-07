## ADDED Requirements

### Requirement: Routes that can sign a transaction are gated by a demo passcode
When `DEMO_PASSCODE` is configured, every route that can place an order or write a signal (`POST /api/order`, `POST /api/signals`, `POST /api/signals/[id]/copy`) SHALL require that value in an `x-demo-passcode` header and SHALL answer `401` with a plain-language message when it is missing or wrong, without revealing the expected value. Read-only routes SHALL remain open. When the variable is not configured, the routes SHALL behave exactly as before, so a local clone needs no code.

#### Scenario: Correct passcode
- **GIVEN** the deployment has `DEMO_PASSCODE` set and the client sends it
- **WHEN** an order is placed
- **THEN** it succeeds exactly as it does locally

#### Scenario: Missing or wrong passcode
- **GIVEN** the deployment has `DEMO_PASSCODE` set
- **WHEN** a write request arrives without the header, or with a wrong value
- **THEN** the response is `401` with a message saying a demo code is needed, the expected value is never returned, and no transaction is signed

#### Scenario: Reading needs no code
- **GIVEN** the deployment has `DEMO_PASSCODE` set
- **WHEN** the feed, a signal detail, the markets, the price or the account is requested
- **THEN** the response is normal: anyone with the link can browse

#### Scenario: Local clone without a passcode
- **GIVEN** `DEMO_PASSCODE` is not set
- **WHEN** any write request arrives
- **THEN** it is handled as before, with no header required

### Requirement: The interface asks for the demo code once
When a write is refused for a missing code, the interface SHALL ask the user for it in plain language, SHALL remember it in the browser for later writes, and SHALL let the user correct it if it is wrong. It SHALL NOT display or log the value it stores anywhere else.

#### Scenario: First write on the deployed app
- **GIVEN** the user has not entered a code
- **WHEN** they tap the primary action
- **THEN** they are asked for the demo code, and after entering the right one the action completes

#### Scenario: Wrong code
- **GIVEN** the user entered a wrong code
- **WHEN** they tap the primary action
- **THEN** they are told the code was not accepted and can type it again
