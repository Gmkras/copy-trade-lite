import { apiHandler } from "@/lib/api";
import { getCandlesByRange } from "@/lib/decibel";
import { CandlesQuery, type CandlesResponse } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/candles/BTC%2FUSD?range=1h|4h|1d|1w — the market's candles for
 * that range at the interval that fits it (default 1h → one-minute candles).
 * Unknown market or range → 422.
 */
export const GET = apiHandler<CandlesResponse>({
  run: ({ params, request }) => {
    const query = CandlesQuery.parse(Object.fromEntries(new URL(request.url).searchParams));
    return getCandlesByRange(decodeURIComponent(params.market ?? ""), query.range);
  },
});
