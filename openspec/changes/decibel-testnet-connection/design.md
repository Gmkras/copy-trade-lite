## Context

`bootstrap-app` left a validated env (`lib/env.schema.ts` + server-only `lib/env.ts`) and no SDK code. The explore session for this change read `@decibeltrade/sdk@0.8.0/dist` and the on-chain ABI of the testnet package; see proposal.md for motivation. Facts that shape this design:

- `DecibelReadDex(config, { nodeApiKey })` and `DecibelWriteDex(config, account, { nodeApiKey, skipSimulate })`; without the key every request is `401`.
- `write.getPrimarySubaccountAddress(accountAddress)` → the subaccount used by all `getByAddr({ subAddr })` reads.
- `write.placeOrder({ marketName, price, size, isBuy, timeInForce, isReduceOnly, builderAddr?, builderFee?, tickSize?, tpTriggerPrice?, slTriggerPrice?, ... })` takes **integer chain units** for `price`/`size`, converts `builderFee` from bps internally (`bps × 100`, `FEE_PRECISION 10000 = 1 %`), catches its own errors and returns `{ success:false, error }`.
- `write.approveMaxBuilderFee({ builderAddr, maxFee, subaccountAddr? })` (bps) and `write.deposit(u64, subaccountAddr?)` return committed transactions.
- Testnet faucet: entry function `<pkg>::usdc::restricted_mint(&signer, u64)`; views `available_restricted_mint_for(address)`, `mints_remaining()`, `restricted_mint_daily_reset_timestamp_for(address)` exposed by `DecibelReadDex`.
- Markets expose `px_decimals`, `sz_decimals`, `tick_size`, `lot_size`, `min_size` (chain units). `TimeInForce.ImmediateOrCancel = 2`.
- `server-only` throws under plain Node, so `tsx` scripts cannot import `lib/env.ts` or any module that imports it.

## Goals / Non-Goals

**Goals:**
- One place that builds the SDK clients; one place that converts units; one place that signs orders with the fee bound asserted last.
- Scripts a reviewer can run from the README in order: smoke → mint → approve → order-once.
- Every failure becomes one readable sentence.

**Non-Goals:**
- Route handlers, UI, WebSocket, signals (later changes).

## Decisions

### D1. Module layout and the server-only boundary
```
lib/decibel/client.ts   getDecibel() lazy singleton: { account, read, write, walletAddr, subaccountAddr, builderAddr, feeBps, maxOrderSize }
lib/decibel/units.ts    pure functions, no SDK imports (unit-tested)
lib/decibel/orders.ts   approveBuilderFee(), placeMarketOrder(), getApprovedBuilderFee()
lib/decibel/errors.ts   TradeError(code, message), humanizeSdkError(unknown)
lib/decibel/index.ts    `import "server-only"` + re-exports for app code
scripts/*.ts            import from "../lib/decibel/client" etc. directly (never from lib/decibel/index or lib/env)
```
`client.ts` reads config through `loadEnv()` from `lib/env.schema.ts` and is itself not guarded, so scripts can use it; app code (route handlers, next change) imports `@/lib/decibel` which carries the `server-only` guard. Alternative: guard every file — rejected, it would break the scripts (verified in the previous change that `server-only` throws under plain Node).

### D2. Env loading for scripts
Scripts call `process.loadEnvFile(".env")` (Node ≥ 21, no `dotenv` dependency) inside a try/catch so a missing file yields the env-validation message rather than an ENOENT stack. Next.js loads `.env` itself, so `client.ts` never loads files.

### D3. Chain units (integers, `number` is enough)
- `toChainUnits(value, decimals) = Math.round(value * 10^decimals)`; `fromChainUnits(units, decimals) = units / 10^decimals`. Magnitudes stay far below 2^53 (BTC price ≈ 6.4e10 units at 6 decimals).
- `roundToTick(priceUnits, tickSize)` = nearest multiple; `floorToLot(sizeUnits, lotSize)` = floor multiple.
- `toValidOrderSize(sizeHuman, market, maxOrderSize)` throws `TradeError("INVALID_SIZE", ...)` for non-finite, ≤ 0, > cap, or < `min_size` after flooring; message always states the allowed range in human units.
- `toAggressiveLimitPrice(midHuman, isBuy, market, slippage = 0.005)` = mid × (1 ± slippage) → chain units → tick-rounded (buy rounds up, sell rounds down) so an IOC order crosses the book.
Alternative: `BigInt` — rejected for this magnitude; adds friction with the SDK's `number` API.

### D4. Fee bound asserted last, from constants only
`orders.ts` reads `feeBps` from the client (env constant, already `0..10`), reads the approved maximum on chain via the SDK view when available (else assumes the constant was approved by the approve script), and throws `TradeError("FEE_BOUND", ...)` if `feeBps > approvedMax || feeBps > 10` **immediately before** `placeOrder`. No function in the codebase accepts a fee as a parameter. Alternative: trust env alone — rejected; S3 asks for the check at the last point before signing.

### D5. Order execution
`placeMarketOrder({ marketName, isBuy, size, tpPrice?, slPrice? })`:
1. `market = markets.find(name)` else `TradeError("UNKNOWN_MARKET")`.
2. `sizeUnits = toValidOrderSize(...)`.
3. `mid = marketPrices.getByName(...)[0].mid_px` else `TradeError("NO_PRICE")`.
4. TP/SL side check against `mid` (long: tp > mid > sl; short: tp < mid < sl) else `TradeError("TPSL_SIDE")`; convert to chain units, tick-rounded.
5. Fee assertion (D4).
6. `write.placeOrder({ ..., timeInForce: TimeInForce.ImmediateOrCancel, isReduceOnly: false, builderAddr, builderFee: feeBps, tickSize: market.tick_size, subaccountAddr })`.
7. `result.success === false` → `throw humanizeSdkError(result.error)`; otherwise return `{ transactionHash, orderId, referencePrice: mid, sizeUnits }`. A thrown SDK error is also humanized. Success is never returned without `transactionHash`.

### D6. Error taxonomy (`errors.ts`)
`TradeError` codes: `INVALID_SIZE`, `UNKNOWN_MARKET`, `NO_PRICE`, `TPSL_SIDE`, `FEE_BOUND`, `INSUFFICIENT_BALANCE`, `NO_GAS`, `API_KEY_REJECTED`, `TX_REJECTED`, `NETWORK`, `UNKNOWN`. `humanizeSdkError(e)` maps by substring: `401`/`anonymous` → `API_KEY_REJECTED` ("Your Geomi API key was rejected — create a testnet key at geomi.dev"); `INSUFFICIENT_BALANCE`/`margin`/`collateral` → `INSUFFICIENT_BALANCE` ("Not enough play money — run `pnpm mint`"); `INSUFFICIENT_BALANCE_FOR_TRANSACTION_FEE`/`gas` → `NO_GAS` ("Wallet needs testnet APT — aptos.dev/network/faucet"); `fetch failed`/`ECONN`/`timeout` → `NETWORK`; anything else → `UNKNOWN` with the original text preserved in `cause` and shortened in `message`. Never swallow: the original error is kept on `cause`.

### D7. Scripts (tsx, ESM)
Each script: load env → build client → do one thing → print a short result → `process.exit(0)`; on error print `TradeError.message` (or humanized) to stderr and `process.exit(1)`; `--verbose` flag prints the cause. `keygen.ts` prints the address and the AIP-80 key string format hint; it prints the private key **only** to stdout on purpose (that is its job) and says so. `mint-usdc.ts [amount=1000]`: checks `availableRestrictedMintFor(wallet)` first, mints via `write.sendTx`-equivalent public path (`aptos.transaction.build.simple` + sign + submit through the SDK's `aptos` instance) calling `restricted_mint(amount_u64)`, then `write.deposit(units, subaccountAddr)`, then prints equity. `approve-builder.ts`: `approveMaxBuilderFee({ builderAddr, maxFee: feeBps, subaccountAddr })`. `order-once.ts [size]`: `placeMarketOrder` with the market minimum, prints `https://explorer.aptoslabs.com/txn/<hash>?network=testnet`.

### D8. Tests
`lib/decibel/units.test.ts` (vitest): conversions, tick/lot rounding, min/max/NaN/negative rejections with message content, aggressive price direction. `orders.ts` gets a test for the TP/SL side check and the fee assertion using an injected fake client (no network).

## Risks / Trade-offs

- [Thin testnet book: IOC may not fill] → order-once reports "sent, not filled" honestly when `orderId` is absent and the position does not appear; slippage can be raised to 1 % via an optional arg.
- [Restricted mint limits per account/day] → mint script checks allowance first and prints the reset time.
- [SDK `console.error`s inside `placeOrder` before returning `success:false`] → accepted; our message is still the readable one.
- [ESM/extension quirks under tsx with the SDK] → the derive-address probe already ran `@aptos-labs/ts-sdk` under tsx on this machine; the SDK is ESM with `"type": "module"`; verified in task 1.2 before writing more code.
- [`process.loadEnvFile` is Node ≥ 21] → README states Node 24; `engines` field added to `package.json`.

## Migration Plan

Greenfield; no migration. Funding steps are documented in the README and are testnet-only.

## Open Questions

None that affect specs or tasks. Whether the on-chain "approved max builder fee" view is exposed by the SDK is checked in task 3.1; if not, the assertion compares against the constant approved by the script (documented in the guide).
