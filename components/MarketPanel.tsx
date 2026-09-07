"use client";

import { useState } from "react";

import { MarketChart, type ChartLine, type ChartMarker } from "@/components/MarketChart";
import { useMediaQuery, WIDE } from "@/hooks/useMediaQuery";
import { usePoll, type PollState } from "@/hooks/usePoll";
import { rangeChange, rangeLabel } from "@/lib/charts";
import { money } from "@/lib/format";
import type { CandleRange, CandlesResponse, Market, Price } from "@/lib/schemas";

const CANDLES_POLL_MS = 15_000;
/**
 * Measured, not estimated: 110 px is what keeps the yellow button above the
 * fold at 375 × 812. On a wide screen the chart has its own column, so it gets
 * the room a trading screen expects.
 */
const CHART_HEIGHT = 110;
const CHART_HEIGHT_WIDE = 420;
/** Stable empty lists: fresh arrays each render would rebuild the chart on every poll. */
const NO_LINES: ChartLine[] = [];
const NO_MARKERS: ChartMarker[] = [];

type MarketPanelProps = {
  market: Market;
  /** The price poll lives in TradeScreen, because the order button needs the same mid. */
  price: PollState<Price>;
};

/** The selected coin's price and chart: the middle panel of the Trade screen. */
export function MarketPanel({ market, price }: MarketPanelProps) {
  const wide = useMediaQuery(WIDE);
  const [range, setRange] = useState<CandleRange>("1h");
  const candles = usePoll<CandlesResponse>(
    `/api/candles/${encodeURIComponent(market.name)}?range=${range}`,
    CANDLES_POLL_MS,
  );

  const mid = price.data?.mid ?? null;
  const shown = candles.data?.candles ?? [];
  const change = rangeChange(shown);
  const digits = market.priceStep >= 1 ? 0 : 2;
  const height = wide ? CHART_HEIGHT_WIDE : CHART_HEIGHT;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-display leading-tight" aria-live="polite">
        <span className="text-sm text-muted">1 {market.symbol} = </span>
        <span className="text-2xl font-bold lg:text-3xl">
          {mid === null ? <span className="text-muted">{price.error ? "price unavailable" : "…"}</span> : `$${money(mid, digits)}`}
        </span>
        {change ? (
          <span className={["ml-2 whitespace-nowrap text-sm", change.abs >= 0 ? "text-up" : "text-down"].join(" ")}>
            {change.abs >= 0 ? "+" : "−"}{Math.abs(change.pct).toFixed(2)}% · {rangeLabel(range)}
          </span>
        ) : null}
        {price.stale ? <span className="ml-2 rounded-full border border-line px-2 text-xs text-muted">couldn&apos;t refresh</span> : null}
      </p>

      {shown.length > 1 ? (
        <MarketChart
          candles={shown}
          lines={NO_LINES}
          markers={NO_MARKERS}
          variant="full"
          compact={!wide}
          range={range}
          onRangeChange={setRange}
          loading={candles.loading}
          height={height}
          precision={digits}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-card border border-line text-sm text-muted"
          style={{ height }}
          aria-live="polite"
        >
          {candles.loading ? "Loading the chart…" : `No price history for ${market.symbol} right now.`}
        </div>
      )}
    </div>
  );
}
