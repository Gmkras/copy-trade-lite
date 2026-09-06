/**
 * Account state in one call: overview, positions with PnL, open orders, fills.
 *
 * The trading API keys positions, orders, fills and prices by market
 * *address*; names come from /markets, so everything is joined here once.
 * An account that has never deposited answers 404 — that is an empty account,
 * not an error (constitution S5).
 *
 * Not guarded (scripts may use it); app code imports via `@/lib/decibel`.
 */
import type { AccountState, Fill, OpenOrder, OrderSide, Position } from "../schemas";
import { getDecibel } from "./client";
import { isNotFoundError } from "./errors";
import { baseSymbol } from "./units";

/** Everything getAccountState reads, so tests can inject fakes. */
export type AccountReader = {
  getMarkets: () => Promise<{ market_name: string; market_addr: string }[]>;
  getPrices: () => Promise<{ market: string; mark_px: number; mid_px: number }[]>;
  getOverview: () => Promise<{
    perp_equity_balance: number;
    usdc_cross_withdrawable_balance: number;
    unrealized_pnl: number;
    cross_available_to_trade?: number | undefined;
  }>;
  getPositions: () => Promise<
    { market: string; size: number; entry_price: number; estimated_liquidation_price: number }[]
  >;
  getOrders: () => Promise<{
    items: { market: string; is_buy: boolean; remaining_size: number | null; orig_size: number | null; price: number | null; unix_ms: number }[];
  }>;
  getFills: () => Promise<{
    items: { market: string; action: string; size: number; price: number; fee_amount: number; transaction_unix_ms: number }[];
  }>;
};

function liveReader(): AccountReader {
  const d = getDecibel();
  const subAddr = d.subaccountAddr;
  return {
    getMarkets: () => d.read.markets.getAll(),
    getPrices: () => d.read.marketPrices.getAll(),
    getOverview: () => d.read.accountOverview.getByAddr({ subAddr }),
    getPositions: () => d.read.userPositions.getByAddr({ subAddr }),
    getOrders: () => d.read.userOpenOrders.getByAddr({ subAddr }),
    getFills: () => d.read.userTradeHistory.getByAddr({ subAddr, limit: 20 }),
  };
}

export function emptyAccount(now = Date.now()): AccountState {
  return { exists: false, equity: 0, available: 0, unrealizedPnl: 0, positions: [], orders: [], fills: [], updatedAt: now };
}

/** Signed size × (mark − entry). Size is negative for shorts. */
export function positionPnl(size: number, entryPrice: number, markPrice: number): { pnlUsd: number; pnlPct: number } {
  const pnlUsd = (markPrice - entryPrice) * size;
  const notional = Math.abs(size) * entryPrice;
  return { pnlUsd, pnlPct: notional > 0 ? pnlUsd / notional : 0 };
}

export function fillSide(action: string): OrderSide {
  return action === "OpenLong" || action === "CloseShort" || action === "Buy" ? "up" : "down";
}

export async function getAccountState(reader: AccountReader = liveReader(), now = Date.now()): Promise<AccountState> {
  const [markets, prices] = await Promise.all([reader.getMarkets(), reader.getPrices()]);
  const nameByAddr = new Map(markets.map((m) => [m.market_addr, m.market_name]));
  const markByAddr = new Map(prices.map((p) => [p.market, p.mark_px]));
  const nameOf = (addr: string) => nameByAddr.get(addr) ?? addr;

  let overview: Awaited<ReturnType<AccountReader["getOverview"]>>;
  let rawPositions: Awaited<ReturnType<AccountReader["getPositions"]>>;
  let rawOrders: Awaited<ReturnType<AccountReader["getOrders"]>>;
  let rawFills: Awaited<ReturnType<AccountReader["getFills"]>>;
  try {
    [overview, rawPositions, rawOrders, rawFills] = await Promise.all([
      reader.getOverview(),
      reader.getPositions(),
      reader.getOrders(),
      reader.getFills(),
    ]);
  } catch (error) {
    if (isNotFoundError(error)) return emptyAccount(now);
    throw error;
  }

  const positions: Position[] = rawPositions
    .filter((p) => p.size !== 0)
    .map((p) => {
      const name = nameOf(p.market);
      const markPrice = markByAddr.get(p.market) ?? p.entry_price;
      const { pnlUsd, pnlPct } = positionPnl(p.size, p.entry_price, markPrice);
      return {
        market: name,
        symbol: baseSymbol(name),
        side: p.size > 0 ? "up" : "down",
        size: Math.abs(p.size),
        entryPrice: p.entry_price,
        markPrice,
        pnlUsd,
        pnlPct,
        liquidationPrice: p.estimated_liquidation_price,
      };
    });

  const orders: OpenOrder[] = rawOrders.items.map((o) => ({
    market: nameOf(o.market),
    side: o.is_buy ? "up" : "down",
    size: o.remaining_size ?? o.orig_size ?? 0,
    price: o.price,
    time: o.unix_ms,
  }));

  const fills: Fill[] = rawFills.items.map((f) => ({
    market: nameOf(f.market),
    action: f.action,
    side: fillSide(f.action),
    size: f.size,
    price: f.price,
    fee: f.fee_amount,
    time: f.transaction_unix_ms,
  }));

  return {
    exists: true,
    equity: overview.perp_equity_balance,
    available: overview.cross_available_to_trade ?? overview.usdc_cross_withdrawable_balance,
    unrealizedPnl: overview.unrealized_pnl,
    positions,
    orders,
    fills,
    updatedAt: now,
  };
}
