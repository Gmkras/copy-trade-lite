import { apiHandler } from "@/lib/api";
import { assertDemoAccess } from "@/lib/auth";
import { assertTradableSize, getPrice } from "@/lib/decibel";
import { SignalInput, type SignalList, type SignalView } from "@/lib/schemas";
import { loadFeed, signalsRepo, tpSlPrices } from "@/lib/signals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/signals — newest first, with copy counts, per-author stats and live prices. */
export const GET = apiHandler<SignalList>({ run: () => loadFeed() });

/**
 * POST /api/signals — { author, market, side, tpPct, slPct, holdHours, size, note? }
 *
 * The entry price is the live mid read here on the server; the client cannot
 * choose it. TP/SL prices are derived from the percentages (sides guaranteed
 * by tpSlPrices) and the size goes through the same bounds as an order.
 */
export const POST = apiHandler<SignalView, SignalInput>({
  guard: assertDemoAccess,
  schema: SignalInput,
  run: async ({ body }) => {
    const price = await getPrice(body.market);
    const size = await assertTradableSize(body.market, body.size);
    const { tpPrice, slPrice } = tpSlPrices(body.side, price.mid, body.tpPct, body.slPct);
    const createdAt = Date.now();
    const signal = await signalsRepo().createSignal({
      author: body.author,
      market: body.market,
      side: body.side,
      entryPrice: price.mid,
      tpPct: body.tpPct,
      slPct: body.slPct,
      tpPrice,
      slPrice,
      holdHours: body.holdHours,
      size,
      note: body.note ?? null,
      createdAt,
      expiresAt: createdAt + body.holdHours * 3_600_000,
    });
    return { ...signal, expired: false };
  },
});
