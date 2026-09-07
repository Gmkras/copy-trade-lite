/**
 * Live market and account events, forwarded from the SDK's WebSocket
 * subscriptions to whoever is connected to `GET /api/stream`.
 *
 * The subscriptions need the Geomi API key, so they only exist here, on the
 * server. One hub per process holds them: the first listener opens them, the
 * last one to leave closes them, and everyone in between shares the same set
 * (design D3). Three viewers cost one set of upstream connections.
 *
 * What travels to the browser is deliberately small: prices, and — for the
 * account — a bare "something changed" so the browser refetches `/api/account`
 * itself. No balance, position or address ever crosses this channel (D2).
 *
 * Not guarded with `server-only` (its test imports it directly); app code
 * imports it through `@/lib/decibel`.
 */
import { getDecibel } from "./client";

export type PriceEvent = { type: "price"; market: string; mid: number; mark: number };
/** Deliberately empty: it means "ask again", never "here is the account". */
export type AccountEvent = { type: "account" };
export type LiveEvent = PriceEvent | AccountEvent;

export type Listener = (event: LiveEvent) => void;

/** Everything the hub needs from the exchange, so tests can inject fakes. */
export type StreamSources = {
  subscribePrices: (onData: (price: { market: string; mid: number; mark: number }) => void) => () => void;
  /** Positions, overview, open orders and fills all mean the same thing: refetch. */
  subscribeAccount: (onChange: () => void) => (() => void)[];
};

/** Several upstream messages inside this window become one `account` event. */
export const ACCOUNT_COALESCE_MS = 250;

type Hub = {
  listeners: Set<Listener>;
  unsubscribes: (() => void)[];
  accountTimer: ReturnType<typeof setTimeout> | null;
};

let hub: Hub | null = null;

function liveSources(): StreamSources {
  const d = getDecibel();
  return {
    subscribePrices: (onData) => {
      // The exchange identifies a market by address on the socket, exactly as
      // it does on the REST prices endpoint; names come from /markets. The map
      // is loaded once when the hub opens, and a price for a market we do not
      // know (a spot pair, say) is dropped rather than forwarded as a hash.
      let nameByAddr: Map<string, string> | null = null;
      void d.read.markets
        .getAll()
        .then((markets) => {
          nameByAddr = new Map(markets.map((m) => [m.market_addr, m.market_name]));
        })
        .catch((error: unknown) => {
          console.error("[stream] could not load market names; prices stay unmapped:", error);
        });

      return d.read.marketPrices.subscribeAll((message) => {
        if (!nameByAddr) return; // still loading: the poll is still covering us
        for (const price of message.prices ?? []) {
          const market = nameByAddr.get(price.market);
          if (!market) continue;
          onData({ market, mid: price.mid_px, mark: price.mark_px });
        }
      });
    },
    subscribeAccount: (onChange) => [
      d.read.userPositions.subscribeByAddr(d.subaccountAddr, () => onChange()),
      d.read.accountOverview.subscribeByAddr(d.subaccountAddr, () => onChange()),
      d.read.userOpenOrders.subscribeByAddr(d.subaccountAddr, () => onChange()),
      d.read.userTradeHistory.subscribeByAddr(d.subaccountAddr, () => onChange()),
    ],
  };
}

/** Sends to every listener; one that throws must not silence the others. */
function emit(current: Hub, event: LiveEvent): void {
  for (const listener of [...current.listeners]) {
    try {
      listener(event);
    } catch (error) {
      console.error("[stream] listener failed:", error);
    }
  }
}

function open(sources: StreamSources): Hub {
  const current: Hub = { listeners: new Set(), unsubscribes: [], accountTimer: null };

  current.unsubscribes.push(
    sources.subscribePrices((price) => {
      if (!Number.isFinite(price.mid) || price.mid <= 0) return; // a quote we would not show
      emit(current, { type: "price", market: price.market, mid: price.mid, mark: price.mark });
    }),
  );

  current.unsubscribes.push(
    ...sources.subscribeAccount(() => {
      // A single fill touches positions, orders and history: send one event.
      if (current.accountTimer) return;
      current.accountTimer = setTimeout(() => {
        current.accountTimer = null;
        emit(current, { type: "account" });
      }, ACCOUNT_COALESCE_MS);
    }),
  );

  return current;
}

function close(current: Hub): void {
  if (current.accountTimer) clearTimeout(current.accountTimer);
  for (const unsubscribe of current.unsubscribes) {
    try {
      unsubscribe();
    } catch (error) {
      console.error("[stream] unsubscribe failed:", error);
    }
  }
  current.unsubscribes = [];
  current.listeners.clear();
}

/**
 * Starts receiving live events. Returns the function that stops it; when the
 * last listener stops, the exchange subscriptions are released.
 */
export function subscribeLive(listener: Listener, sources: StreamSources = liveSources()): () => void {
  if (!hub) hub = open(sources);
  const current = hub;
  current.listeners.add(listener);

  let done = false;
  return () => {
    if (done) return; // calling it twice must not close the hub for everyone
    done = true;
    current.listeners.delete(listener);
    if (current.listeners.size === 0 && hub === current) {
      hub = null;
      close(current);
    }
  };
}

/** How many viewers this process is serving. For tests and diagnostics. */
export function liveListenerCount(): number {
  return hub?.listeners.size ?? 0;
}
