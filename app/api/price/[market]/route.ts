import { apiHandler } from "@/lib/api";
import { getPrice } from "@/lib/decibel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/price/BTC%2FUSD — live mid and mark price. Unknown market → 422. */
export const GET = apiHandler({
  run: ({ params }) => getPrice(decodeURIComponent(params.market ?? "")),
});
