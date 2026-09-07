import { apiHandler, NotFoundError } from "@/lib/api";
import { assertDemoAccess } from "@/lib/auth";
import { TradeError, errorText, placeMarketOrder, type MarketOrderResult } from "@/lib/decibel";
import { CopyInput, type CopyReceipt } from "@/lib/schemas";
import { isExpired, signalsRepo } from "@/lib/signals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPLORER_TX = "https://explorer.aptoslabs.com/txn";

/**
 * POST /api/signals/[id]/copy — { copier, size? }
 *
 * One tap: the equivalent order goes through the exact same boundary as the
 * trade screen (placeMarketOrder: size bounds, builder code, fee bound), with
 * the idea's take-profit / stop-loss attached. If the exchange rejects the
 * trigger prices, the order is placed without them and the receipt says so.
 */
export const POST = apiHandler<CopyReceipt, CopyInput>({
  guard: assertDemoAccess,
  schema: CopyInput,
  run: async ({ body, params }) => {
    const repo = signalsRepo();
    const signal = await repo.getSignal(params.id ?? "");
    if (!signal) throw new NotFoundError("That idea was not found.");
    if (isExpired(signal)) {
      throw new TradeError("SIGNAL_EXPIRED", "This idea has expired, so it can't be copied anymore. Pick a live one from the feed.");
    }

    const size = body.size ?? signal.size;
    const isBuy = signal.side === "up";

    let result: MarketOrderResult;
    let tpSlAttached = true;
    try {
      result = await placeMarketOrder({ marketName: signal.market, isBuy, size, tpPrice: signal.tpPrice, slPrice: signal.slPrice });
    } catch (error) {
      if (!isTriggerPriceRejection(error)) throw error;
      // The chain refused the TP/SL trigger prices on this order type. Nothing was
      // committed (the SDK returns success:false before submitting), so retry plainly.
      console.warn("[copy] TP/SL rejected, placing without triggers:", errorText(error));
      tpSlAttached = false;
      result = await placeMarketOrder({ marketName: signal.market, isBuy, size });
    }

    // The order is on chain. Recording the copy must never turn that into a failure.
    let copyId: string | null = null;
    let copyCount = signal.copyCount;
    try {
      const copy = await repo.addCopy(signal.id, {
        copier: body.copier,
        size: result.size,
        fillPrice: result.referencePrice,
        txHash: result.transactionHash,
      });
      copyId = copy.id;
      copyCount = (await repo.getSignal(signal.id))?.copyCount ?? signal.copyCount + 1;
    } catch (error) {
      console.error(
        `[copy] ORDER PLACED BUT NOT RECORDED — signal ${signal.id}, tx ${result.transactionHash}, copier ${body.copier}:`,
        error,
      );
    }

    return {
      transactionHash: result.transactionHash,
      explorerUrl: `${EXPLORER_TX}/${result.transactionHash}?network=testnet`,
      orderId: result.orderId ?? null,
      market: result.marketName,
      side: result.isBuy ? "up" : "down",
      size: result.size,
      referencePrice: result.referencePrice,
      limitPrice: result.limitPrice,
      copyId,
      copyCount,
      tpSlAttached,
    };
  },
});

/**
 * Only retry without triggers when the chain's message clearly blames them.
 *
 * The patterns must be anchored: a loose /tp|sl/ matches "http" inside any URL
 * in the error text, which would place a second order after an unrelated
 * rejection. Only whole Move identifiers count.
 */
const TRIGGER_REJECTION = /\b(tp|sl)_(trigger|limit)_price\b|\btake_profit\b|\bstop_loss\b|\btrigger_price\b|\bE[A-Z_]*TRIGGER[A-Z_]*\b|\bE[A-Z_]*TPSL[A-Z_]*\b/i;

export function isTriggerPriceRejection(error: unknown): boolean {
  if (!(error instanceof TradeError) || error.code !== "TX_REJECTED") return false;
  return TRIGGER_REJECTION.test(errorText(error.cause ?? error));
}
