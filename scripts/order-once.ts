/**
 * Places ONE real market order on Aptos testnet with the builder code attached.
 *
 *   pnpm order:once [size] [--sell] [--verbose]
 *
 * Defaults to the BTC/USD minimum size, buying. Prints the transaction hash,
 * the explorer link, the reference and limit prices, and whether an order id
 * came back (an IOC on a thin book can be sent without filling).
 */
import { getDecibel } from "../lib/decibel/client";
import { TradeError, isNotFoundError } from "../lib/decibel/errors";
import { placeMarketOrder } from "../lib/decibel/orders";
import { fromChainUnits } from "../lib/decibel/units";
import { money, positionalArgs, run, txUrl } from "./_env";

const MARKET = "BTC/USD";

run(async () => {
  const d = getDecibel();
  const isBuy = !process.argv.includes("--sell");
  const [sizeArg] = positionalArgs();

  const markets = await d.read.markets.getAll();
  const market = markets.find((m) => m.market_name === MARKET);
  if (!market) throw new TradeError("UNKNOWN_MARKET", `${MARKET} is not listed on testnet right now.`);

  const size = sizeArg === undefined ? fromChainUnits(market.min_size, market.sz_decimals) : Number(sizeArg);
  console.log(`${isBuy ? "Buying" : "Selling"} ${size} BTC on ${MARKET} (IOC, builder fee ${d.feeBps} bps)…`);

  const result = await placeMarketOrder({ marketName: MARKET, isBuy, size });

  console.log(`\ntransaction   ${result.transactionHash}`);
  console.log(`explorer      ${txUrl(result.transactionHash)}`);
  console.log(`reference     $${money(result.referencePrice)}   limit $${money(result.limitPrice)}`);
  console.log(`size          ${result.size} BTC (${result.sizeUnits} units)`);
  console.log(`order id      ${result.orderId ?? "(none returned — sent, may not have filled)"}`);

  try {
    const positions = await d.read.userPositions.getByAddr({ subAddr: d.subaccountAddr });
    const btc = positions.find((p) => p.market === MARKET);
    console.log(
      btc
        ? `position      ${MARKET} size ${btc.size} entry $${money(btc.entry_price)}`
        : "position      none yet (IOC may not have filled, or the indexer is catching up — check `pnpm smoke`)",
    );
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    console.log("position      (account not indexed yet — check `pnpm smoke`)");
  }
  console.log("✓ order transaction committed");
});
