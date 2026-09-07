"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Card } from "@/components/Card";
import { IdeaStrip } from "@/components/IdeaStrip";
import { MarketChart, type ChartLine, type ChartMarker } from "@/components/MarketChart";
import { useToast } from "@/components/Toast";
import { fetchEnvelope } from "@/hooks/usePoll";
import { amount, symbolOf, timeAgo } from "@/lib/format";
import type { AuthorStats, Candle, CandleRange, CandlesResponse, SignalView } from "@/lib/schemas";
import { progressSentence, timeLeftLabel } from "@/lib/signals/math";

type SignalCardProps = {
  signal: SignalView;
  stats?: AuthorStats;
  /** Reference time for "12m ago" / "3h left" (the feed's updatedAt, so renders stay pure). */
  now: number;
  /** Live mid of the idea's market from the feed, or null when it could not be read. */
  livePrice: number | null;
  /** The market's last hour of candles from the feed; empty when they could not be read. */
  candles: Candle[];
};

const LINE_COLORS = { entry: "#f5c400", tp: "#22c55e", sl: "#ef4444" };
const CARD_CHART_HEIGHT = 170;
/** Stable empty list: a fresh array each render would rebuild every chart on every poll. */
const NO_MARKERS: ChartMarker[] = [];

/**
 * One trade idea as a social post a first-time visitor can read without
 * tapping: who, the direction in words and colour, the coin's own candles
 * with the idea drawn over them (the same chart as everywhere else), and one
 * action that says where it goes.
 *
 * The last hour comes with the feed; a longer range is fetched once when the
 * user asks for it and kept here, so the feed's refresh does not reset it.
 */
export function SignalCard({ signal, stats, now, livePrice, candles }: SignalCardProps) {
  const { show } = useToast();
  const initial = signal.author.trim().charAt(0).toUpperCase() || "?";
  const up = signal.side === "up";
  const digits = signal.entryPrice >= 100 ? 0 : 2;

  const [range, setRange] = useState<CandleRange>("1h");
  const [override, setOverride] = useState<{ range: CandleRange; candles: Candle[] } | null>(null);
  const [loading, setLoading] = useState(false);

  async function changeRange(next: CandleRange) {
    setRange(next);
    if (next === "1h") return; // the feed keeps the hour fresh
    if (override?.range === next) return;
    setLoading(true);
    try {
      const response = await fetchEnvelope<CandlesResponse>(`/api/candles/${encodeURIComponent(signal.market)}?range=${next}`);
      setOverride({ range: next, candles: response.candles });
    } catch (error) {
      show(error instanceof Error ? error.message : "Couldn't load more history.", { variant: "error" });
      setRange("1h");
    } finally {
      setLoading(false);
    }
  }

  const shown = range === "1h" ? candles : override?.range === range ? override.candles : candles;

  const lines = useMemo<ChartLine[]>(
    () => [
      { price: signal.entryPrice, label: "Entry", color: LINE_COLORS.entry },
      { price: signal.tpPrice, label: "Take profit", color: LINE_COLORS.tp },
      { price: signal.slPrice, label: "Stop loss", color: LINE_COLORS.sl },
    ],
    [signal.entryPrice, signal.tpPrice, signal.slPrice],
  );
  const sentence = progressSentence(signal, livePrice);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-yellow font-display text-lg font-bold text-bg"
        >
          {initial}
        </span>
        <p className="min-w-0 flex-1 text-sm text-muted">
          <span className="font-display text-base font-medium text-text">{signal.author}</span> · {timeAgo(signal.createdAt, now)}
          {stats ? ` · ${stats.ideas} ${stats.ideas === 1 ? "idea" : "ideas"} · ${stats.copies} ${stats.copies === 1 ? "copy" : "copies"}` : ""}
        </p>
      </div>

      <p className={["font-display text-xl font-bold leading-tight", up ? "text-up" : "text-down"].join(" ")}>
        {symbolOf(signal.market)} goes {up ? "up ↑" : "down ↓"}
      </p>

      {shown.length > 1 ? (
        <div className="flex flex-col gap-1">
          <MarketChart
            candles={shown}
            lines={lines}
            markers={NO_MARKERS}
            variant="card"
            range={range}
            onRangeChange={(next) => void changeRange(next)}
            loading={loading}
            height={CARD_CHART_HEIGHT}
            precision={digits}
          />
          <p className="text-sm text-muted">{sentence}</p>
        </div>
      ) : (
        <IdeaStrip
          side={signal.side}
          entryPrice={signal.entryPrice}
          tpPrice={signal.tpPrice}
          slPrice={signal.slPrice}
          expired={signal.expired}
          livePrice={livePrice}
        />
      )}

      {signal.note ? <p className="text-sm text-muted">“{signal.note}”</p> : null}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full border border-up/40 px-2 py-0.5 text-up">
          Take profit {up ? "+" : "−"}{amount(signal.tpPct)}%
        </span>
        <span className="rounded-full border border-down/40 px-2 py-0.5 text-down">
          Stop loss {up ? "−" : "+"}{amount(signal.slPct)}%
        </span>
      </div>

      <div className="flex items-center justify-between text-sm text-muted">
        <span>copied {signal.copyCount}×</span>
        <span className={signal.expired ? "" : "text-text"}>
          {signal.expired ? "expired" : `live · ${timeLeftLabel(signal, now)}`}
        </span>
      </div>

      <Link
        href={`/signals/${signal.id}`}
        className={[
          "flex min-h-12 items-center justify-center rounded-2xl font-display text-lg font-bold",
          signal.expired
            ? "border border-line text-muted"
            : // On a phone this is the screen's one primary action. On a wide
              // screen the chart is already open beside the list, so opening an
              // idea is navigation and the yellow belongs to "Copy this trade"
              // (constitution P1: one kind of primary action per screen).
              "bg-yellow text-bg lg:border lg:border-line lg:bg-transparent lg:text-text",
        ].join(" ")}
      >
        {signal.expired ? "See how it went" : "See it on the chart"}
      </Link>
    </Card>
  );
}
