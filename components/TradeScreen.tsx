"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { AccountCard } from "@/components/AccountCard";
import { CoinPills } from "@/components/CoinPills";
import type { ChartLine } from "@/components/MarketChart";
import { MarketPanel } from "@/components/MarketPanel";
import { PositionsPanel } from "@/components/PositionsPanel";
import { TradeForm } from "@/components/TradeForm";
import { useLive } from "@/hooks/useLive";
import { DESK, useMediaQuery } from "@/hooks/useMediaQuery";
import { usePoll } from "@/hooks/usePoll";
import type { AccountState, Market, MarketStats, Price, Ticker } from "@/lib/schemas";

/** Timer intervals. While the stream is connected the polls become a heartbeat
 *  that repairs anything the stream missed; when it drops they take over again. */
const ACCOUNT_POLL_MS = 5000;
const PRICE_POLL_MS = 5000;
const HEARTBEAT_MS = 30_000;
/** The day's figures move once a minute at most: six times slower than the price. */
const STATS_POLL_MS = 30_000;
/** The coin strip's prices; the stream overrides these whenever it is connected. */
const TICKERS_POLL_MS = 15_000;

/** White, so the account's own line is never confused with an idea's yellow
 *  Entry or with the one yellow action on the screen (constitution P1). */
const POSITION_COLORS = { entry: "#f5f5f4", liquidation: "#ef4444" };
/** Stable empty list: a new array each render would rebuild the chart every poll. */
const NO_LINES: ChartLine[] = [];

/**
 * The Trade screen. Owns the selected coin, the live stream and the two polls
 * its panels share, so the layout can move them around: one column on a phone
 * (coins, price and chart, ticket, account) and a trading-desk grid on a wide
 * screen (coins across the top, chart, ticket, account).
 */
export function TradeScreen({ markets }: { markets: Market[] }) {
  const [marketName, setMarketName] = useState(markets[0]?.name ?? "BTC/USD");
  const market = markets.find((m) => m.name === marketName) ?? markets[0];

  // The DOM itself differs on a desk — tabs instead of accordion sections, a
  // chart that measures its slot — which is the case this hook exists for.
  const desk = useMediaQuery(DESK);
  // Below a desk the chart and the ticket take turns instead of stacking.
  // Measured: stacked, with the day's figures and the chart's legend added,
  // the yellow button landed at 827 px on an 812 px screen. Two tabs let the
  // chart be 320 px AND keep the one action reachable without scrolling.
  // "Trade" first, because the action is what the screen is for.
  const [pane, setPane] = useState<"chart" | "trade">("trade");
  const live = useLive();
  const price = usePoll<Price>(
    market ? `/api/price/${encodeURIComponent(market.name)}` : null,
    live.live ? HEARTBEAT_MS : PRICE_POLL_MS,
  );
  const account = usePoll<AccountState>("/api/account", live.live ? HEARTBEAT_MS : ACCOUNT_POLL_MS);
  const stats = usePoll<MarketStats>(
    market ? `/api/stats/${encodeURIComponent(market.name)}` : null,
    STATS_POLL_MS,
  );
  const tickers = usePoll<Ticker[]>("/api/tickers", TICKERS_POLL_MS);

  // The stream says "something changed"; the account is fetched the way it
  // always is, so there is only one implementation of it (design D2).
  const refreshAccount = account.refresh;
  const seenVersion = useRef(0);
  useEffect(() => {
    if (live.accountVersion === seenVersion.current) return;
    seenVersion.current = live.accountVersion;
    refreshAccount();
  }, [live.accountVersion, refreshAccount]);

  // The strip's figures: the 24-hour change from the poll, the price from the
  // stream when it is connected and from the poll when it is not.
  const quotes = useMemo(() => {
    const map: Record<string, { mid: number | null; changePct24h: number | null }> = {};
    for (const ticker of tickers.data ?? []) {
      map[ticker.market] = { mid: live.prices[ticker.market] ?? ticker.mid, changePct24h: ticker.changePct24h };
    }
    return map;
  }, [tickers.data, live.prices]);

  // Your own position, drawn on the chart you are trading (design D8). Memoised
  // on the two prices rather than on the position object, whose identity is new
  // after every poll: an unchanged position must not rebuild the chart.
  const held = account.data?.positions.find((p) => p.market === marketName) ?? null;
  const entryPrice = held?.entryPrice ?? null;
  const liquidationPrice = held?.liquidationPrice ?? null;
  const positionLines = useMemo<ChartLine[]>(() => {
    if (entryPrice === null || !Number.isFinite(entryPrice) || entryPrice <= 0) return NO_LINES;
    // Pinned: a position opened days ago sits outside an hour of candles, and
    // an entry you cannot see is the one number you most wanted (design D5/D8).
    const lines: ChartLine[] = [
      { price: entryPrice, label: "Your entry", color: POSITION_COLORS.entry, pinned: true },
    ];
    // The exchange reports 0 for a position that cannot be liquidated at this
    // leverage; a line at $0 would be worse than no line at all.
    if (liquidationPrice !== null && Number.isFinite(liquidationPrice) && liquidationPrice > 0) {
      lines.push({ price: liquidationPrice, label: "Liquidation", color: POSITION_COLORS.liquidation });
    }
    return lines;
  }, [entryPrice, liquidationPrice]);

  if (!market) {
    return <p className="text-muted">No markets are open right now. Try again in a moment.</p>;
  }

  const liveMid = live.prices[market.name] ?? null;

  return (
    // Phone: one column, in the order a person reads it — coins, price, chart,
    // ticket, account. Desk (from `desk:`, which is 1024 px wide AND 700 px
    // tall): a viewport-height grid with the chart column on the left and the
    // ticket rail on the right. Each column is ONE element, so the DOM order is
    // left column then right rail — reading order — and no `order` class ever
    // sends the tab focus somewhere the eye is not.
    <div
      className={[
        "flex flex-col gap-4",
        // The height comes from the page, which sizes itself to the viewport:
        // no arithmetic about headers and padding, which is what produced a
        // 908 px Buy button the last time this layout was reasoned about.
        "desk:grid desk:min-h-0 desk:flex-1 desk:grid-cols-[minmax(0,1fr)_minmax(0,340px)]",
        "desk:grid-rows-[auto_minmax(0,1fr)] desk:gap-4",
      ].join(" ")}
    >
      <div className="desk:col-span-2">
        <CoinPills markets={markets} selected={market.name} onSelect={setMarketName} quotes={quotes} />
        {!desk ? <PaneTabs pane={pane} onChange={setPane} /> : null}
      </div>

      {/* Left column: the chart grows into whatever is left after the header,
          and the account's three lists sit under it as tabs. */}
      <div className={["min-h-0 flex-col gap-4 desk:flex desk:gap-3", !desk && pane !== "chart" ? "hidden" : "flex"].join(" ")}>
        <div className="min-h-0 desk:flex-1">
          <MarketPanel
            market={market}
            price={price}
            stats={stats}
            liveMid={liveMid}
            live={live.live}
            lines={positionLines}
            fill={desk}
          />
        </div>
        {desk ? (
          // A definite share of the column, not a max: with `shrink-0` and only
          // a max-height the panel kept its content height and pushed the
          // column past the viewport, where `overflow-hidden` clipped the last
          // rows. A basis gives it a size the list can then scroll inside.
          <div className="min-h-0 shrink-0 basis-[28%]">
            <PositionsPanel state={account.data} loading={account.loading} />
          </div>
        ) : null}
      </div>

      {/* Right rail: the one yellow action first, then the three numbers. */}
      <div
        className={[
          "min-h-0 flex-col gap-4 desk:flex desk:overflow-y-auto",
          !desk && pane !== "trade" ? "hidden" : "flex",
        ].join(" ")}
      >
        <TradeForm market={market} mid={liveMid ?? price.data?.mid ?? null} onOrderPlaced={refreshAccount} />
        <AccountCard
          state={account.data}
          stale={account.stale}
          loading={account.loading}
          error={account.error}
          live={live.live}
          showLists={!desk}
        />
      </div>
    </div>
  );
}

/**
 * Chart or Trade, below a desk. Two tabs rather than one long column, so the
 * chart can be 320 px and the yellow button still needs no scrolling.
 */
function PaneTabs({ pane, onChange }: { pane: "chart" | "trade"; onChange: (next: "chart" | "trade") => void }) {
  const panes = [
    { id: "trade", label: "Trade" },
    { id: "chart", label: "Chart" },
  ] as const;

  return (
    <div role="tablist" aria-label="Chart or trade" className="mt-3 flex gap-1 border-b border-line">
      {panes.map(({ id, label }) => {
        const active = pane === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                event.preventDefault();
                onChange(pane === "trade" ? "chart" : "trade");
              }
            }}
            className={[
              "-mb-px min-h-11 border-b-2 px-4 font-display text-base font-medium transition-colors",
              active ? "border-text text-text" : "border-transparent text-muted",
            ].join(" ")}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
