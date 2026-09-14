"use client";

import { useState } from "react";

import { MarketChart, type ChartLine, type ChartMarker } from "@/components/MarketChart";
import { MarketStatsBar } from "@/components/MarketStatsBar";
import { useMediaQuery, WIDE } from "@/hooks/useMediaQuery";
import { usePoll, type PollState } from "@/hooks/usePoll";
import { rangeChange, rangeLabel } from "@/lib/charts";
import { money } from "@/lib/format";
import type { CandleRange, CandlesResponse, Market, MarketStats, Price } from "@/lib/schemas";

const CANDLES_POLL_MS = 15_000;
/**
 * Measured, not estimated. 110 px used to be what kept the yellow button above
 * the fold at 375 × 812, when the chart and the ticket shared one column. They
 * now take turns as two tabs, so the chart gets the room the screen can spare
 * and the button still needs no scrolling.
 */
const CHART_HEIGHT = 320;
const CHART_HEIGHT_WIDE = 420;
/** Stable empty lists: fresh arrays each render would rebuild the chart on every poll. */
const NO_LINES: ChartLine[] = [];
const NO_MARKERS: ChartMarker[] = [];

type MarketPanelProps = {
  market: Market;
  /** The price poll lives in TradeScreen, because the order button needs the same mid. */
  price: PollState<Price>;
  /** The day's figures for this market, polled by TradeScreen at its own slower cadence. */
  stats: PollState<MarketStats>;
  /** Latest streamed mid for this market, when the stream is connected. */
  liveMid?: number | null;
  live?: boolean;
  /** Lines to draw over the candles — the account's position in this market. */
  lines?: ChartLine[];
  /** Pixel height for the chart; the wide layout measures it from the space left over. */
  chartHeight?: number;
  /** Grow the chart into the height this panel is given, instead of a fixed number. */
  fill?: boolean;
};

/** The selected coin's price, its day, and its chart: the middle panel of the Trade screen. */
export function MarketPanel({
  market,
  price,
  stats,
  liveMid = null,
  live = false,
  lines = NO_LINES,
  chartHeight,
  fill = false,
}: MarketPanelProps) {
  const wide = useMediaQuery(WIDE);
  const [range, setRange] = useState<CandleRange>("1h");
  const candles = usePoll<CandlesResponse>(
    `/api/candles/${encodeURIComponent(market.name)}?range=${range}`,
    CANDLES_POLL_MS,
  );

  // The stream wins when it is connected; the poll is the fallback and the
  // first paint.
  const mid = liveMid ?? price.data?.mid ?? null;
  const shown = candles.data?.candles ?? [];
  const change = rangeChange(shown);
  const digits = market.priceStep >= 1 ? 0 : 2;
  const height = chartHeight ?? (wide ? CHART_HEIGHT_WIDE : CHART_HEIGHT);

  return (
    <div className={["flex flex-col gap-1.5", fill ? "h-full min-h-0" : ""].join(" ")}>
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
        {price.stale && !live ? (
          <span className="ml-2 rounded-full border border-line px-2 text-xs text-muted">couldn&apos;t refresh</span>
        ) : null}
        {live ? <span className="ml-2 text-xs text-up">live</span> : null}
      </p>

      <MarketStatsBar stats={stats} digits={digits} />

      {shown.length > 1 ? (
        <MarketChart
          candles={shown}
          lines={lines}
          markers={NO_MARKERS}
          variant="full"
          compact={!wide}
          range={range}
          onRangeChange={setRange}
          loading={candles.loading}
          height={height}
          fill={fill}
          precision={digits}
        />
      ) : (
        <div
          className={[
            "flex items-center justify-center rounded-card border border-line text-sm text-muted",
            fill ? "min-h-0 flex-1" : "",
          ].join(" ")}
          style={fill ? undefined : { height }}
          aria-live="polite"
        >
          {candles.loading ? "Loading the chart…" : `No price history for ${market.symbol} right now.`}
        </div>
      )}
    </div>
  );
}
