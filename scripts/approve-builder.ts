/**
 * Step 1 of builder codes (one-time, idempotent): approve the configured
 * builder address for at most BUILDER_FEE_BPS on the primary subaccount, and
 * record the approval in the database (DATABASE_URL) so orders can assert the
 * bound before signing — from this machine or from a deployment that shares
 * the same database.
 *
 *   pnpm approve [--verbose]
 */
import { getDecibel } from "../lib/decibel/client";
import { approveBuilderFee, readBuilderApproval } from "../lib/decibel/orders";
import { run, txUrl } from "./_env";

run(async () => {
  const d = getDecibel();
  const existing = await readBuilderApproval(d.subaccountAddr, d.builderAddr);
  if (existing && existing.maxFeeBps === d.feeBps) {
    console.log(`already approved  ${existing.maxFeeBps} bps for ${existing.builderAddr}`);
    console.log(`                  ${txUrl(existing.transactionHash)} (${existing.approvedAt})`);
    console.log("re-approving anyway to make sure the chain agrees…");
  }

  const record = await approveBuilderFee();
  console.log(`approved          ${record.maxFeeBps} bps for ${record.builderAddr}`);
  console.log(`subaccount        ${record.subaccountAddr}`);
  console.log(`transaction       ${txUrl(record.transactionHash)}`);
  console.log(`recorded in       the database at DATABASE_URL (table builder_approvals)`);
  console.log("✓ builder fee approved");
});
