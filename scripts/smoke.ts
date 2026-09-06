/**
 * Smoke check: proves credentials and connectivity without sending any
 * transaction. Prints wallet, subaccount, APT gas balance, open perp markets,
 * BTC/USD mid price and account equity. Never prints secrets.
 *
 *   pnpm smoke [--verbose]
 */
import { getDecibel } from "../lib/decibel/client";
import { isNotFoundError } from "../lib/decibel/errors";
import { fromChainUnits } from "../lib/decibel/units";
import { money, run } from "./_env";

run(async () => {
  const d = getDecibel();
  console.log("Copy-Trade Lite · smoke check (Aptos testnet)\n");
  console.log(`wallet      ${d.walletAddr}`);
  console.log(`subaccount  ${d.subaccountAddr}`);
  console.log(`builder     ${d.builderAddr}  fee ${d.feeBps} bps  max order ${d.maxOrderSize}`);

  const apt = await d.read.deps.aptos.getAccountAPTAmount({ accountAddress: d.walletAddr });
  console.log(`gas         ${money(apt / 1e8, 4)} APT${apt === 0 ? "  ← empty: get testnet APT at https://aptos.dev/network/faucet" : ""}`);

  const markets = await d.read.markets.getAll();
  const open = markets.filter((m) => m.mode === "Open");
  console.log(`\nmarkets     ${open.length} open perp markets`);
  for (const m of open.slice(0, 8)) {
    const minSize = fromChainUnits(m.min_size, m.sz_decimals);
    const tick = fromChainUnits(m.tick_size, m.px_decimals);
    console.log(`  ${m.market_name.padEnd(10)} min ${minSize}  tick ${tick}  lot ${fromChainUnits(m.lot_size, m.sz_decimals)}  decimals px=${m.px_decimals} sz=${m.sz_decimals}`);
  }
  if (open.length > 8) console.log(`  … and ${open.length - 8} more`);

  const [price] = await d.read.marketPrices.getByName({ marketName: "BTC/USD" });
  if (!price) throw new Error("No price returned for BTC/USD");
  console.log(`\nBTC/USD     mid $${money(price.mid_px)}  mark $${money(price.mark_px)}  oracle $${money(price.oracle_px)}`);

  // The primary subaccount is created on the first deposit; before that the
  // trading API answers 404. That is an empty account, not an error.
  try {
    const overview = await d.read.accountOverview.getByAddr({ subAddr: d.subaccountAddr });
    console.log(`\nequity      $${money(overview.perp_equity_balance)}  withdrawable $${money(overview.usdc_cross_withdrawable_balance)}  unrealized PnL $${money(overview.unrealized_pnl)}`);

    const positions = await d.read.userPositions.getByAddr({ subAddr: d.subaccountAddr });
    const orders = await d.read.userOpenOrders.getByAddr({ subAddr: d.subaccountAddr });
    console.log(`positions   ${positions.length}   open orders ${orders.items.length}`);
    for (const p of positions) {
      console.log(`  ${p.market}  size ${p.size}  entry $${money(p.entry_price)}  liq $${money(p.estimated_liquidation_price)}`);
    }
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    console.log("\nequity      $0.00  (trading account not created yet — run `pnpm mint` to deposit play money)");
    console.log("positions   0   open orders 0");
  }

  console.log("\n✓ connection OK");
});
