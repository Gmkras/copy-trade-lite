## 1. Dependencies and SDK client (≈60 min)

- [ ] 1.1 Add `@decibeltrade/sdk@0.8.0`, `@aptos-labs/ts-sdk@^7.1.0` (deps) and `tsx`, `@types/ws` (dev deps); add `"engines": { "node": ">=22" }` and script aliases `keygen`, `smoke`, `mint`, `approve`, `order:once` (all `tsx scripts/<name>.ts`). Verify: `pnpm install` succeeds; `pnpm typecheck` exits 0.
- [ ] 1.2 Create `lib/decibel/errors.ts` (`TradeError` with the codes from design D6, `humanizeSdkError`) and `lib/decibel/client.ts` (`getDecibel()` lazy singleton per design D1: account from `PRIVATE_KEY`, `DecibelReadDex`/`DecibelWriteDex` with `TESTNET_CONFIG` + `nodeApiKey`, `walletAddr`, `subaccountAddr`, `builderAddr` padded to 64 hex, `feeBps`, `maxOrderSize`). Create `lib/decibel/index.ts` with `import "server-only"` re-exporting the public surface. Verify: `pnpm typecheck` exits 0; a throwaway `tsx -e` that imports `client.ts` and prints `walletAddr` shows `0xdc47…86cc` (no key printed).

## 2. Chain units with tests (≈45 min)

- [ ] 2.1 Create `lib/decibel/units.ts` (`toChainUnits`, `fromChainUnits`, `roundToTick`, `floorToLot`, `toValidOrderSize`, `toAggressiveLimitPrice`) per design D3 with plain-language range messages. Verify: `pnpm typecheck` exits 0.
- [ ] 2.2 Create `lib/decibel/units.test.ts` covering: exact conversions; tick rounding (64123.456 → 64123.5 at tick 0.1); lot flooring (0.0015 → 0.001); rejections for 0, negative, NaN, below minimum, above `MAX_ORDER_SIZE` with the message naming the range; aggressive price rounds up for buys and down for sells. Verify: `pnpm test` reports all tests passing.

## 3. Smoke, keygen and funding scripts (≈60 min)

- [ ] 3.1 Create `scripts/_env.ts` (loads `.env` with `process.loadEnvFile` in try/catch, exports `run(main)` that prints `TradeError` messages and exits 1 on failure, `--verbose` prints the cause) and `scripts/smoke.ts` (wallet, subaccount, open perp markets, BTC/USD mid, equity). Verify: `pnpm smoke` prints the five items with real values and exits 0; with a wrong `APTOS_NODE_API_KEY` it exits 1 with the "API key was rejected" message and no stack trace.
- [ ] 3.2 Create `scripts/keygen.ts` (generates an Ed25519 account, prints address and the private key with a warning that it is meant for `.env` only). Verify: running it prints a new `0x…` address and a key string; nothing is written to disk.
- [ ] 3.3 Create `scripts/mint-usdc.ts [amount]` per design D7: check `availableRestrictedMintFor(wallet)` and reset timestamp, call `usdc::restricted_mint(amount_u64)`, then `write.deposit(units, subaccountAddr)`, print both hashes and the new equity. Verify: `pnpm mint` on this account exits 0 and `pnpm smoke` then shows equity > 0; running with an amount above the allowance exits 1 with the allowance message before any transaction.

## 4. Builder fee approval and first real order (≈75 min)

- [ ] 4.1 Create `lib/decibel/orders.ts` with `approveBuilderFee()`, `getApprovedBuilderFee()` (SDK view if available, else `null`), and `placeMarketOrder()` per design D5 (fee assertion immediately before `placeOrder`, TP/SL side check, IOC 0.5 % through mid, `success:false` → thrown `TradeError`, never success without hash). Add `lib/decibel/orders.test.ts` for the TP/SL side check and the fee assertion with a fake client. Verify: `pnpm test` green; `pnpm typecheck` exits 0.
- [ ] 4.2 Create `scripts/approve-builder.ts`. Verify: `pnpm approve` prints a transaction hash and "approved 10 bps for 0x…"; running it a second time does not fail with a stack trace.
- [ ] 4.3 Create `scripts/order-once.ts [size]` (defaults to the BTC/USD minimum; prints hash, explorer link, reference price, and whether an order id came back). Verify: `pnpm order:once` prints a hash that opens at `https://explorer.aptoslabs.com/txn/<hash>?network=testnet` with status success, and `pnpm smoke` afterwards lists a BTC/USD position or a fill. Record the hash in the commit body.
- [ ] 4.4 Unhappy-path proof: temporarily set `BUILDER_FEE_BPS=10` in `.env` but modify the approval to 5 bps (run approve with an env override) and run `pnpm order:once`. Verify: the order is rejected before signing with the fee-bound message; restore the 10 bps approval afterwards. Also run `pnpm order:once 0` and `pnpm order:once 5`: both rejected with the size-range message, no transaction.

## 5. Docs and review

- [ ] 5.1 Update `README.md`: status table (MUST 1 and MUST 2 ✅), "Fund your testnet account" section (faucet → `pnpm mint` → `pnpm approve` → `pnpm order:once` with expected output), scripts table, and the "biggest risk" note mentioning the fee bound. Verify: a reader can go from a fresh `.env` to a real order following only the README.
- [ ] 5.2 Run the P-R review prompt on the diff of this change against `specs/constitution.md` (safety first: any path to `placeOrder` without `toValidOrderSize`, any fee not from env, any mainnet reference, any secret printed, any swallowed error or success without hash). Verify: findings fixed in a separate `fix:` commit, or "no findings" recorded.
