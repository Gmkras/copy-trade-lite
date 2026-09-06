import { apiHandler } from "@/lib/api";
import { listMarkets } from "@/lib/decibel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/markets — open perp markets in human units, BTC/USD first. */
export const GET = apiHandler({ run: () => listMarkets() });
