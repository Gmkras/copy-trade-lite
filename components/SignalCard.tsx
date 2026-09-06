"use client";

import Link from "next/link";

import { Card } from "@/components/Card";
import { amount, money, timeAgo } from "@/lib/format";
import type { AuthorStats, SignalView } from "@/lib/schemas";
import { headline, timeLeftLabel } from "@/lib/signals/math";

type SignalCardProps = {
  signal: SignalView;
  stats?: AuthorStats;
  /** Reference time for "12m ago" / "3h left" (the feed's updatedAt, so renders stay pure). */
  now: number;
};

/** One trade idea as a social post: who, what, TP/SL, how many copied it, and one Copy action. */
export function SignalCard({ signal, stats, now }: SignalCardProps) {
  const initial = signal.author.trim().charAt(0).toUpperCase() || "?";
  const up = signal.side === "up";
  const digits = signal.entryPrice >= 100 ? 0 : 2;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-yellow font-display text-lg font-bold text-bg"
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-medium leading-tight">
            {signal.author} <span className="font-normal text-muted">{headline(signal)}</span>
          </p>
          <p className="text-sm text-muted">
            {timeAgo(signal.createdAt, now)}
            {stats ? ` · ${stats.ideas} ${stats.ideas === 1 ? "idea" : "ideas"} · ${stats.copies} ${stats.copies === 1 ? "copy" : "copies"}` : ""}
          </p>
        </div>
        <span
          className={[
            "shrink-0 rounded-full border px-2 py-0.5 text-xs",
            signal.expired ? "border-line text-muted" : "border-line text-text",
          ].join(" ")}
        >
          {signal.expired ? "expired" : `live · ${timeLeftLabel(signal, now)}`}
        </span>
      </div>

      <p className="text-sm text-muted">
        In at ${money(signal.entryPrice, digits)} with {amount(signal.size)} {signal.symbol}
        {signal.note ? ` — “${signal.note}”` : ""}
      </p>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full border border-up/40 px-2 py-0.5 text-up">
          Take profit {up ? "+" : "−"}{amount(signal.tpPct)}%
        </span>
        <span className="rounded-full border border-down/40 px-2 py-0.5 text-down">
          Stop loss {up ? "−" : "+"}{amount(signal.slPct)}%
        </span>
        <span className="ml-auto text-muted">copied {signal.copyCount}×</span>
      </div>

      <Link
        href={`/signals/${signal.id}`}
        className={[
          "flex min-h-12 items-center justify-center rounded-2xl font-display text-lg font-bold",
          signal.expired ? "border border-line text-muted" : "bg-yellow text-bg",
        ].join(" ")}
      >
        {signal.expired ? "See how it went" : "Copy"}
      </Link>
    </Card>
  );
}
