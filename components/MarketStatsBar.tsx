"use client";

import type { ReactNode } from "react";

import type { PollState } from "@/hooks/usePoll";
import { compact, everyLabel, money } from "@/lib/format";
import type { MarketStats } from "@/lib/schemas";

type MarketStatsBarProps = {
  /** The stats poll lives in TradeScreen, beside the other polls it owns. */
  stats: PollState<MarketStats>;
  /** Decimals for prices in this market (0 for BTC-like, 2 for small ones). */
  digits: number;
};

/**
 * The day, beside the price: the row every terminal puts under the symbol.
 *
 * A figure the exchange did not give us reads "—", never 0 — a zero low would
 * be a claim about the market, and an invented one (constitution S6). The
 * units of volume and open interest are not documented by the SDK, so none is
 * printed rather than guessed.
 */
export function MarketStatsBar({ stats, digits }: MarketStatsBarProps) {
  const s = stats.data;
  const change = s?.changePct24h ?? null;
  const changeTone = change === null ? "text-text" : change >= 0 ? "text-up" : "text-down";

  return (
    // One row that scrolls on a phone rather than wrapping: wrapped, these six
    // figures took 92 px of a 812 px screen and pushed the yellow button out of
    // sight. It fades at the edge exactly like the coin strip, so a cut-off
    // figure reads as "there is more".
    <dl
      className="flex items-baseline gap-x-5 overflow-x-auto whitespace-nowrap pb-0.5 text-sm desk:flex-wrap desk:gap-y-1 desk:overflow-x-visible"
      aria-label="Last 24 hours"
      style={{
        maskImage: "linear-gradient(to right, black calc(100% - 24px), transparent)",
        WebkitMaskImage: "linear-gradient(to right, black calc(100% - 24px), transparent)",
      }}
    >
      <Figure label="24h change">
        <span className={changeTone}>
          {change === null ? "—" : `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(2)}%`}
        </span>
      </Figure>
      <Figure label="24h high">{s?.high24h == null ? "—" : `$${money(s.high24h, digits)}`}</Figure>
      <Figure label="24h low">{s?.low24h == null ? "—" : `$${money(s.low24h, digits)}`}</Figure>
      <Figure label="24h volume">{s?.volume24h == null ? "—" : compact(s.volume24h)}</Figure>
      <Figure label="Open interest">{s?.openInterest == null ? "—" : compact(s.openInterest)}</Figure>
      <Figure label="Funding">
        {s?.fundingRateBps == null ? (
          "—"
        ) : (
          // Basis points are jargon this app does not use (constitution P2):
          // the same number as a percentage, with how often it is charged.
          <span className={s.isFundingPositive === false ? "text-down" : "text-up"}>
            {s.isFundingPositive === false ? "−" : "+"}
            {(Math.abs(s.fundingRateBps) / 100).toFixed(4)}%
            {/* Only when the period is actually known: "every —" is not a sentence. */}
            {s.fundingPeriodS == null ? null : (
              <span className="text-muted"> every {everyLabel(s.fundingPeriodS)}</span>
            )}
          </span>
        )}
      </Figure>
      {stats.stale ? (
        <span className="rounded-full border border-line px-2 text-xs text-muted">couldn&apos;t refresh</span>
      ) : null}
    </dl>
  );
}

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex shrink-0 items-baseline gap-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className="font-display font-medium tabular-nums">{children}</dd>
    </div>
  );
}
