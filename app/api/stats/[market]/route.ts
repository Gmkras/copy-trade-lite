import { apiHandler } from "@/lib/api";
import { getMarketStats } from "@/lib/decibel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/stats/BTC%2FUSD — the day's figures for one market. Read-only: no
 * body, no query, no guard. Unknown market → 422, like `/api/price`.
 */
export const GET = apiHandler({
  run: ({ params }) => getMarketStats(decodeURIComponent(params.market ?? "")),
});
