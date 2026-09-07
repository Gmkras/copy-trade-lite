## 1. Candles by range (≈45 min)

- [ ] 1.1 Add `CandleRange` (`1h | 4h | 1d | 1w`), `CandlesResponse` to `lib/schemas.ts`; `rangeToInterval(range)` and `rangeChange(candles)` as pure functions in `lib/decibel/units.ts` (or a new `lib/charts.ts`, client-safe) with tests (each range → interval and count; change sign and percent; empty list → null). Change `getCandles(market, { interval, count })` in `lib/decibel/markets.ts` and update its three callers (`getCandlesFor`, the detail route, the feed loader). Verify: `pnpm test` green, `pnpm typecheck` exits 0.
- [ ] 1.2 Create `app/api/candles/[market]/route.ts` (`apiHandler`, zod query, `UNKNOWN_MARKET` for a market not in the list, default range 1h). Verify with the dev server: `curl "localhost:3000/api/candles/BTC%2FUSD?range=1h"` → ~60 candles `interval: "1m"`; `range=1w` → ~168 at `"1h"`; `FOO%2FUSD` and `range=3y` → 422 with a readable message.

## 2. The chart component (≈90 min)

- [ ] 2.1 Rename `PriceChart*` to `MarketChart*` and add to the inner module: series by `type` (candles / line / area), the toolbar (type, range, zoom − / + / reset per design D3), `variant` (card: no grid, level titles on the left with `axisLabelVisible: false`, last price only; full: grid and both axes), `scaleMargins` 0.12, a `priceFormatter` with thousands separators, and markers placed `belowBar` with a text background. Persist `chart.type` in `localStorage` (try/catch). Verify: `pnpm lint` (no `set-state-in-effect`), and at 375 px on the dev server the feed cards show the compact toolbar, no stacked axis labels and a 1h chart; tapping Line / Area switches every chart after a reload.
- [ ] 2.2 Wire ranges: `SignalCard` keeps a per-card range with a one-off fetch on tap (1h stays fed by the feed loader); `SignalDetail` fetches on range change and keeps markers at their times; zoom buttons change the visible logical range and reset fits. Verify with agent-browser at 375 px: tap 1d on one card → that card shows 15-minute candles, the other cards keep 1h, the next feed poll does not reset it; on the detail tap 1w → hourly candles with the copy marker still visible; + twice then reset narrows and restores (assert `getVisibleLogicalRange` before/after).

## 3. The Trade screen (≈60 min)

- [ ] 3.1 Add the price hero and `MarketChart` (160 px, full variant) to `TradeForm` under the price line, polling `/api/candles/[market]?range=` every 15 s for the selected coin; hero change from `rangeChange`. Verify with agent-browser at 375 × 812: BTC chart renders with Candles · 1h; the yellow button's bottom edge is above the bottom nav without scrolling (measure `getBoundingClientRect`); tapping AAVE switches hero and chart; the Up/Down, size and Buy flow still place a real testnet order (record the hash).
- [ ] 3.2 Candles unavailable on Trade: temporarily point the route at a market with no candles (or stub) → the chart area reads "No price history for … right now" and the form works; restore. Coin-row edge fade in `CoinPills` and the "You think" fix in `describe()` with a test. Verify: screenshot shows the fade; `pnpm test` green.

## 4. Documentation and the live check (≈30 min)

- [ ] 4.1 README: status rows MUST 3 and SHOULD 6 mention the chart with types, ranges and zoom; demo path step 1 names the chart; API contract row for `/api/candles`; project structure (`MarketChart`, candles route). Interview guide gains the section for this change. Verify: `grep -n PriceChart README.md` → none.
- [ ] 4.2 After the push and the Vercel deploy: at 375 px on the live URL, Trade shows the chart and the button above the fold; a feed card switches to 1d; the detail switches to Line; `curl` the candles route for 1w. Record the deployed order hash in the commit body.

## 5. Change review

- [ ] 5.1 Run the P-R review prompt on the diff against `specs/constitution.md`, with two extra questions: does any chart control lead to a write (it must not), and does the Trade screen still have exactly one yellow action. Verify: findings fixed in a separate `fix:` commit, or "no findings" recorded here.
