import { apiHandler } from "@/lib/api";
import { getAccountState } from "@/lib/decibel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/account — equity, available, PnL, positions (with PnL), open orders, last fills. */
export const GET = apiHandler({ run: () => getAccountState() });
