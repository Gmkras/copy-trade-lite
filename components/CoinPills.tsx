"use client";

import { useRef } from "react";

import { money } from "@/lib/format";
import type { Market } from "@/lib/schemas";

/** What a pill shows besides its name; either figure may be missing. */
export type PillQuote = { mid: number | null; changePct24h: number | null };

type CoinPillsProps = {
  markets: Market[];
  selected: string;
  onSelect: (marketName: string) => void;
  /** Live price and 24-hour change per market name; absent markets show the symbol alone. */
  quotes?: Record<string, PillQuote>;
};

/**
 * Horizontal row of coin pills. The active pill inverts colors; yellow stays
 * reserved for the main button.
 *
 * Keyboard: a radiogroup is one tab stop (roving tabindex), so a keyboard user
 * reaches the form after one Tab instead of stepping through 36 coins; arrows
 * move between pills, as the ARIA radiogroup pattern expects.
 */
export function CoinPills({ markets, selected, onSelect, quotes = {} }: CoinPillsProps) {
  const container = useRef<HTMLDivElement | null>(null);

  function move(delta: number, from: number) {
    const next = (from + delta + markets.length) % markets.length;
    const market = markets[next];
    if (!market) return;
    onSelect(market.name);
    const buttons = container.current?.querySelectorAll<HTMLButtonElement>("[role=radio]");
    buttons?.[next]?.focus();
  }

  return (
    <div
      ref={container}
      role="radiogroup"
      aria-label="Coin"
      className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1"
      // The row fades at its right edge so a cut-off pill reads as "more coins".
      style={{ maskImage: "linear-gradient(to right, black calc(100% - 28px), transparent)", WebkitMaskImage: "linear-gradient(to right, black calc(100% - 28px), transparent)" }}
    >
      {markets.map((market, index) => {
        const active = market.name === selected;
        const quote = quotes[market.name];
        const change = quote?.changePct24h ?? null;
        // On the selected pill the background is the text colour, so the up and
        // down greens would be unreadable: it states the change in its own ink.
        const changeTone = active ? "" : change === null ? "text-muted" : change >= 0 ? "text-up" : "text-down";
        return (
          <button
            key={market.name}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(market.name)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                move(1, index);
              } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                move(-1, index);
              }
            }}
            className={[
              "flex min-h-11 shrink-0 flex-col items-start justify-center rounded-2xl border px-3 py-1.5 font-display transition-colors",
              active ? "border-text bg-text text-bg" : "border-line bg-surface text-muted hover:text-text",
            ].join(" ")}
          >
            <span className={["text-base font-medium leading-tight", active ? "" : "text-text"].join(" ")}>
              {market.symbol}
            </span>
            {quote ? (
              <span className="flex items-baseline gap-1.5 text-xs leading-tight tabular-nums">
                <span>{quote.mid === null ? "—" : `$${money(quote.mid, quote.mid >= 100 ? 0 : 2)}`}</span>
                <span className={changeTone}>
                  {change === null ? "" : `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(2)}%`}
                </span>
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
