"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Card } from "@/components/Card";
import { IdeaStrip } from "@/components/IdeaStrip";
import { PriceChart, type ChartLine, type ChartMarker } from "@/components/PriceChart";
import { amount, symbolOf, timeAgo } from "@/lib/format";
import type { AuthorStats, Candle, SignalView } from "@/lib/schemas";
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
 * with the idea drawn over them (the same chart as the detail), and one
 * action that says where it goes.
 */
export function SignalCard({ signal, stats, now, livePrice, candles }: SignalCardProps) {
  const initial = signal.author.trim().charAt(0).toUpperCase() || "?";
  const up = signal.side === "up";
  const digits = signal.entryPrice >= 100 ? 0 : 2;

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

      {candles.length > 1 ? (
        <div className="flex flex-col gap-1">
          <PriceChart candles={candles} lines={lines} markers={NO_MARKERS} height={CARD_CHART_HEIGHT} precision={digits} />
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
          signal.expired ? "border border-line text-muted" : "bg-yellow text-bg",
        ].join(" ")}
      >
        {signal.expired ? "See how it went" : "See it on the chart"}
      </Link>
    </Card>
  );
}
