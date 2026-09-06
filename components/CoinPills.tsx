"use client";

import type { Market } from "@/lib/schemas";

type CoinPillsProps = {
  markets: Market[];
  selected: string;
  onSelect: (marketName: string) => void;
};

/** Horizontal row of coin pills. The active pill inverts colors; yellow stays reserved for the main button. */
export function CoinPills({ markets, selected, onSelect }: CoinPillsProps) {
  return (
    <div role="radiogroup" aria-label="Coin" className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
      {markets.map((market) => {
        const active = market.name === selected;
        return (
          <button
            key={market.name}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(market.name)}
            className={[
              "min-h-11 shrink-0 rounded-full border px-4 font-display text-base font-medium transition-colors",
              active ? "border-text bg-text text-bg" : "border-line bg-surface text-muted hover:text-text",
            ].join(" ")}
          >
            {market.symbol}
          </button>
        );
      })}
    </div>
  );
}
