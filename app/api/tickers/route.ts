import { apiHandler } from "@/lib/api";
import { listTickers } from "@/lib/decibel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tickers — one row per tradable market with its live mid and 24-hour
 * change, for the coin strip. Read-only: no body, no query, no guard.
 */
export const GET = apiHandler({ run: () => listTickers() });
