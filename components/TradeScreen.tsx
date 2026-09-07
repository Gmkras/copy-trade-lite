"use client";

import { useEffect, useRef, useState } from "react";

import { AccountCard } from "@/components/AccountCard";
import { CoinPills } from "@/components/CoinPills";
import { MarketPanel } from "@/components/MarketPanel";
import { TradeForm } from "@/components/TradeForm";
import { useLive } from "@/hooks/useLive";
import { usePoll } from "@/hooks/usePoll";
import type { AccountState, Market, Price } from "@/lib/schemas";

/** Timer intervals. While the stream is connected the polls become a heartbeat
 *  that repairs anything the stream missed; when it drops they take over again. */
const ACCOUNT_POLL_MS = 5000;
const PRICE_POLL_MS = 5000;
const HEARTBEAT_MS = 30_000;

/**
 * The Trade screen. Owns the selected coin, the live stream and the two polls
 * its panels share, so the layout can move them around: one column on a phone
 * (coins, price and chart, ticket, account) and a trading-desk grid on a wide
 * screen (coins across the top, chart, ticket, account).
 */
export function TradeScreen({ markets }: { markets: Market[] }) {
  const [marketName, setMarketName] = useState(markets[0]?.name ?? "BTC/USD");
  const market = markets.find((m) => m.name === marketName) ?? markets[0];

  const live = useLive();
  const price = usePoll<Price>(
    market ? `/api/price/${encodeURIComponent(market.name)}` : null,
    live.live ? HEARTBEAT_MS : PRICE_POLL_MS,
  );
  const account = usePoll<AccountState>("/api/account", live.live ? HEARTBEAT_MS : ACCOUNT_POLL_MS);

  // The stream says "something changed"; the account is fetched the way it
  // always is, so there is only one implementation of it (design D2).
  const refreshAccount = account.refresh;
  const seenVersion = useRef(0);
  useEffect(() => {
    if (live.accountVersion === seenVersion.current) return;
    seenVersion.current = live.accountVersion;
    refreshAccount();
  }, [live.accountVersion, refreshAccount]);

  if (!market) {
    return <p className="text-muted">No markets are open right now. Try again in a moment.</p>;
  }

  const liveMid = live.prices[market.name] ?? null;

  return (
    // Panels are written in the order a person reads them — coins, chart,
    // ticket, account — so the same sequence serves the phone column, the wide
    // grid (chart left, ticket right, as trading platforms lay it out) and the
    // keyboard. No `order` classes, so tab order always follows what you see.
    <div
      className={[
        "flex flex-col gap-5",
        "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] lg:items-start lg:gap-6",
        "xl:grid-cols-[minmax(0,1fr)_minmax(0,340px)_minmax(0,340px)]",
      ].join(" ")}
    >
      <div className="lg:col-span-2 xl:col-span-3">
        <CoinPills markets={markets} selected={market.name} onSelect={setMarketName} />
      </div>

      <MarketPanel market={market} price={price} liveMid={liveMid} live={live.live} />

      <TradeForm market={market} mid={liveMid ?? price.data?.mid ?? null} onOrderPlaced={refreshAccount} />

      {/* Full width under the desk at lg; its own column, scrolling inside, from xl. */}
      <div className="lg:col-span-2 xl:col-span-1 xl:max-h-[calc(100dvh-9rem)] xl:overflow-y-auto">
        <AccountCard
          state={account.data}
          stale={account.stale}
          loading={account.loading}
          error={account.error}
          live={live.live}
        />
      </div>
    </div>
  );
}
