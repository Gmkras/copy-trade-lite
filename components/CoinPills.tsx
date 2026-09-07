"use client";

import { useRef } from "react";

import type { Market } from "@/lib/schemas";

type CoinPillsProps = {
  markets: Market[];
  selected: string;
  onSelect: (marketName: string) => void;
};

/**
 * Horizontal row of coin pills. The active pill inverts colors; yellow stays
 * reserved for the main button.
 *
 * Keyboard: a radiogroup is one tab stop (roving tabindex), so a keyboard user
 * reaches the form after one Tab instead of stepping through 36 coins; arrows
 * move between pills, as the ARIA radiogroup pattern expects.
 */
export function CoinPills({ markets, selected, onSelect }: CoinPillsProps) {
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
    <div ref={container} role="radiogroup" aria-label="Coin" className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-2">
      {markets.map((market, index) => {
        const active = market.name === selected;
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
