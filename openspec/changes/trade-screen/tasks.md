## 1. Contract and API handler (≈45 min)

- [x] 1.1 Create `lib/schemas.ts` (zod `OrderInput` `.strict()` with `side: "up" | "down"`, shared response types `Market`, `Price`, `AccountState`, `OrderReceipt`, and the `ApiEnvelope` types) and `lib/format.ts` (`money`, `amount`, `pct`, `timeAgo`; client-safe). Add `lib/schemas.test.ts` covering: valid body, string size coerced, `size: "abc"` rejected, extra field `builderFee` rejected, bad side rejected. Verify: `pnpm test` green; `pnpm typecheck` exits 0.
- [x] 1.2 Create `lib/api.ts` with `apiHandler()` per design D2 (ZodError → 422 `INVALID_INPUT`, `TradeError` → 422 with code, unknown → 502 `UPSTREAM` + server log; malformed JSON → 400). Verify: `pnpm typecheck` exits 0; a unit test calls the handler with a throwing function and asserts the 502 envelope contains no stack text.

## 2. Read routes (≈45 min)

- [x] 2.1 Create `lib/decibel/account.ts` (`getAccountState()` per design D3: concurrent reads, 404 → empty state, per-position mark price and PnL in USD and percent) and export it from `lib/decibel/index.ts`. Add `lib/decibel/account.test.ts` for the PnL math (long and short) with a fake reader. Verify: `pnpm test` green.
- [x] 2.2 Create `app/api/markets/route.ts` (open perps, BTC/USD first, human `minSize`, `sizeStep`, `priceStep`, plus `maxOrderSize`), `app/api/price/[market]/route.ts` (mid, mark; unknown market → 422), `app/api/account/route.ts`, all with `runtime = "nodejs"` through `apiHandler`. Verify: with `pnpm dev`, `curl /api/markets` shows BTC/USD first with `minSize: 0.00002`; `curl /api/price/BTC%2FUSD` shows a positive mid; `curl /api/price/FOO%2FUSD` returns 422 (DOGE/USD turned out to exist on testnet); `curl /api/account` returns 200 with the current position and `pnlUsd`/`pnlPct` on it.

## 3. Order route (≈30 min)

- [x] 3.1 Create `app/api/order/route.ts` (`POST`, `OrderInput` → `placeMarketOrder({ marketName, isBuy: side === "up", size })` → `OrderReceipt` with `explorerUrl`). Verify with curl: `size: "abc"` → 422 with the range message; `size: 5` → 422 "more than this app allows"; extra field `builderFee: 1` → 422; `{market:"BTC/USD", side:"up", size:0.00002}` → 200 with a hash that opens on the explorer. Record the hash in the commit body.

## 4. Trade screen (≈90 min)

- [ ] 4.1 Create `hooks/usePoll.ts` per design D4 (interval, AbortController, last good data, `stale`, `refresh`). Verify: `pnpm typecheck` exits 0; a unit test with a mocked `fetch` asserts data is kept and `stale` becomes true after a failed refresh, then false after a success.
- [ ] 4.2 Create `components/CoinPills.tsx`, `SideToggle.tsx`, `SizePicker.tsx` and `TradeForm.tsx` (client; state per design D5; chips `[min, min×5, min×10]`; free input with min hint; price line "1 BTC = $…" from `/api/price` every 5 s; yellow BigButton label with size and ≈ dollar value; pending guard against double submit; success toast with explorer link; error toast with the server message). Replace `app/trade/page.tsx`. Verify with agent-browser at 375 px: default state (BTC, Up, first chip, enabled button with "Buy 0.00002 BTC ≈ $…"); tap Down + third chip → label "Sell 0.0002 BTC ≈ $…"; type `0` → button disabled + range hint; no jargon words on the page.
- [ ] 4.3 Create `components/AccountCard.tsx` (client; `usePoll("/api/account", 5000)`; three big numbers; Positions open by default, Orders and Fills collapsible; PnL colors; empty states; "couldn't refresh" chip) and mount it under the form. Verify with agent-browser: the position row shows PnL in $ and %; numbers change across two polls; after blocking `/api/account` (agent-browser `network route --abort`) the chip appears and the last numbers stay; unblocking clears the chip.
- [ ] 4.4 End-to-end from the UI at 375 px: tap the yellow button once with the minimum size. Verify: busy label, then success toast with an explorer link that opens a successful transaction, and the Positions list updates within 10 s; a rapid double tap sends exactly one `POST /api/order` (check the dev log). Record the hash in the commit body.

## 5. Docs and review

- [ ] 5.1 Update `README.md`: MUST 3–4 ✅, "Demo path" from the UI (open /trade → Up → chip → button → explorer → account card), trade-screen rows in the manual checklist (typed 0, size above cap, unplug network → chip). Verify: a reader can place an order from the UI following only the README.
- [ ] 5.2 Run the P-R review prompt on the diff of this change against `specs/constitution.md` (safety first: any path to `placeOrder` outside `placeMarketOrder`; any request field that could set fee/price/address; any secret or internal detail in an error response; any swallowed error). Verify: findings fixed in a separate `fix:` commit, or "no findings" recorded.
