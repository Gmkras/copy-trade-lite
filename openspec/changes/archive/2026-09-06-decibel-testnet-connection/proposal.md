## Why

Nothing in the brief counts until the app can talk to Decibel on Aptos testnet with the user's own key and place one real order with a builder code. This change delivers exactly that, server-side and script-driven, before any trading UI exists, so the riskiest integration (SDK signatures, chain units, funding, builder-fee approval) is proven first.

**Tier served:** MUST 1 (connect + authenticate) and MUST 2 (real testnet order with builder codes, approve → place).

## What Changes

- Add `@decibeltrade/sdk` 0.8 and `@aptos-labs/ts-sdk` 7 (plus `tsx` and `@types/ws` as dev deps).
- Add a **server-only SDK client** built once from the validated env: account from `PRIVATE_KEY`, read and write clients with `TESTNET_CONFIG` and the Geomi `nodeApiKey`, the primary subaccount address, and the builder address padded to 64 hex chars.
- Add **chain-unit conversion** helpers (human ↔ integer units per market `px_decimals`/`sz_decimals`, tick and lot rounding, minimum size, aggressive limit price through the mid) with unit tests.
- Add an **order module** with `approveBuilderFee()` and `placeMarketOrder()`: validates size, reads the live mid, builds an IOC limit 0.5 % through the mid, attaches the builder address and the fee constant, asserts `fee <= approved max <= 10 bps` right before signing, optionally attaches TP/SL trigger prices, and returns `{ transactionHash, orderId?, referencePrice }` or throws a `TradeError` with a plain-language message. Includes `humanizeSdkError`.
- Add **scripts** run with `tsx`: `keygen` (new testnet account), `smoke` (wallet, subaccount, markets, BTC/USD mid, equity), `mint-usdc` (testnet `restricted_mint` + `deposit`), `approve-builder` (one-time approval), `order-once` (minimum BTC/USD order, prints explorer link).
- Update `README.md`: status table (MUST 1–2 ✅ when verified), "Fund your testnet account" steps, script table.

## Capabilities

### New Capabilities
- `decibel-connection`: authenticated, testnet-only access to Decibel from the server — configuration, reads (markets, prices, account), funding and builder-fee approval, and market-order execution with builder codes and safety bounds.

### Modified Capabilities
- (none)

## Non-goals

- No API routes and no UI; everything is exercised through scripts and tests (next change: `trade-screen`).
- No WebSocket subscriptions, no signals, no persistence.
- No mainnet paths of any kind; `MAINNET_CONFIG` is never imported.

## Impact

- New files: `lib/decibel/client.ts`, `lib/decibel/units.ts` (+ `units.test.ts`), `lib/decibel/orders.ts`, `lib/decibel/errors.ts`, `scripts/*.ts`.
- `package.json`: new dependencies and `pnpm` script aliases (`smoke`, `mint`, `approve`, `order:once`, `keygen`).
- `lib/env.schema.ts` is reused unchanged; scripts import it (not `lib/env.ts`) because `server-only` throws under plain Node.
- Testnet funds: the wallet needs APT for gas (faucet) and test USDC (mint script); the builder-fee approval is one on-chain transaction.
