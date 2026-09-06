import { apiHandler } from "@/lib/api";
import { placeMarketOrder } from "@/lib/decibel";
import { OrderInput, type OrderReceipt } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPLORER_TX = "https://explorer.aptoslabs.com/txn";

/**
 * POST /api/order — { market, side: "up" | "down", size }
 *
 * The body can only choose coin, direction and size. Price (IOC through the
 * mid), builder address, builder fee and time-in-force are decided server-side
 * inside placeMarketOrder, which also enforces the size bounds and the fee
 * bound before signing.
 */
export const POST = apiHandler<OrderReceipt, OrderInput>({
  schema: OrderInput,
  run: async ({ body }) => {
    const result = await placeMarketOrder({
      marketName: body.market,
      isBuy: body.side === "up",
      size: body.size,
    });
    return {
      transactionHash: result.transactionHash,
      explorerUrl: `${EXPLORER_TX}/${result.transactionHash}?network=testnet`,
      orderId: result.orderId ?? null,
      market: result.marketName,
      side: result.isBuy ? "up" : "down",
      size: result.size,
      referencePrice: result.referencePrice,
      limitPrice: result.limitPrice,
    };
  },
});
