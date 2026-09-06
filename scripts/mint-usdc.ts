/**
 * Mints test USDC through Decibel's TESTNET-ONLY faucet function and deposits
 * it into the primary trading subaccount.
 *
 *   pnpm mint [amount=1000] [--verbose]
 *
 * Two transactions: `<pkg>::usdc::restricted_mint(amount)` to the wallet,
 * then `deposit(amount)` into the subaccount. Checks the per-account
 * allowance first and refuses without sending anything if it is exhausted.
 */
import { getDecibel } from "../lib/decibel/client";
import { TradeError, isNotFoundError } from "../lib/decibel/errors";
import { fromChainUnits, toChainUnits } from "../lib/decibel/units";
import { money, positionalArgs, run, txUrl } from "./_env";

run(async () => {
  const d = getDecibel();
  const [amountArg] = positionalArgs();
  const amountHuman = amountArg === undefined ? 1000 : Number(amountArg);
  if (!Number.isFinite(amountHuman) || amountHuman <= 0) {
    throw new TradeError("INVALID_SIZE", "Amount must be a positive number of USDC, e.g. `pnpm mint 500`.");
  }

  const decimals = await d.read.usdcDecimals();
  const amountUnits = toChainUnits(amountHuman, decimals);

  const [available, resetTs] = await Promise.all([
    d.read.availableRestrictedMintFor(d.walletAddr),
    d.read.getAccountTriggerResetMintTs(d.walletAddr),
  ]);
  const availableHuman = fromChainUnits(available, decimals);
  console.log(`mint allowance  ${money(availableHuman)} USDC available for this wallet`);

  if (amountUnits > available) {
    const resetAt = resetTs > 0 ? new Date(resetTs * 1000).toLocaleString("en-US") : "unknown";
    throw new TradeError(
      "INSUFFICIENT_BALANCE",
      available === 0
        ? `The testnet USDC allowance for this wallet is used up. It resets at ${resetAt}. Try again later or use a smaller amount.`
        : `Only ${money(availableHuman)} USDC can be minted right now (resets at ${resetAt}). Run \`pnpm mint ${Math.floor(availableHuman)}\`.`,
    );
  }

  // 1) restricted_mint(amount) → wallet. The SDK has no public helper for the
  //    faucet, so we build the entry-function call through its Aptos client.
  const aptos = d.write.aptos;
  const mintTx = await aptos.transaction.build.simple({
    sender: d.write.account.accountAddress,
    data: {
      function: `${d.write.config.deployment.package}::usdc::restricted_mint`,
      functionArguments: [amountUnits],
    },
  });
  const pending = await aptos.signAndSubmitTransaction({ signer: d.write.account, transaction: mintTx });
  const minted = await aptos.waitForTransaction({ transactionHash: pending.hash });
  if (!minted.success) {
    throw new TradeError("TX_REJECTED", `Mint transaction failed on chain: ${minted.vm_status}`);
  }
  console.log(`minted          ${money(amountHuman)} USDC  ${txUrl(minted.hash)}`);

  // 2) deposit(amount) → primary subaccount (where trading happens).
  const deposited = await d.write.deposit(amountUnits, d.subaccountAddr);
  if (!deposited.success) {
    throw new TradeError("TX_REJECTED", `Deposit transaction failed on chain: ${deposited.vm_status}`);
  }
  console.log(`deposited       ${money(amountHuman)} USDC  ${txUrl(deposited.hash)}`);

  // The trading API indexes the new subaccount a few seconds after the first
  // deposit; both transactions are already committed, so we only retry the read.
  const overview = await readOverviewWithRetry(d, 6, 2000);
  if (overview) {
    console.log(`\nequity now      $${money(overview.perp_equity_balance)}  (withdrawable $${money(overview.usdc_cross_withdrawable_balance)})`);
  } else {
    console.log("\nequity now      (not indexed yet — run `pnpm smoke` in a few seconds)");
  }
  console.log("✓ play money ready");
});

async function readOverviewWithRetry(d: ReturnType<typeof getDecibel>, attempts: number, delayMs: number) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await d.read.accountOverview.getByAddr({ subAddr: d.subaccountAddr });
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return null;
}
