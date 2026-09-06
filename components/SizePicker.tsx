"use client";

import { amount } from "@/lib/format";
import type { Market } from "@/lib/schemas";

type SizePickerProps = {
  market: Market;
  /** Raw text of the input; the parent parses and validates it. */
  value: string;
  onChange: (value: string) => void;
  valid: boolean;
};

/** Chips are derived from the market minimum: [min, 5×min, 10×min]. */
export function sizeChips(market: Market): number[] {
  const { minSize, maxOrderSize } = market;
  return [minSize, minSize * 5, minSize * 10].filter((size) => size <= maxOrderSize);
}

export function SizePicker({ market, value, onChange, valid }: SizePickerProps) {
  const chips = sizeChips(market);
  const hintId = "size-hint";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <label htmlFor="size" className="font-display text-lg font-medium">
          How much?
        </label>
        <span className="text-sm text-muted">in {market.symbol}</span>
      </div>
      <div className="flex gap-2">
        {chips.map((chip) => {
          const text = amount(chip);
          const active = value === text;
          return (
            <button
              key={text}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(text)}
              className={[
                "min-h-11 flex-1 rounded-full border px-3 font-display text-base font-medium",
                active ? "border-text bg-text text-bg" : "border-line bg-surface text-muted hover:text-text",
              ].join(" ")}
            >
              {text}
            </button>
          );
        })}
      </div>
      <input
        id="size"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={amount(market.minSize)}
        aria-invalid={!valid}
        aria-describedby={hintId}
        className={[
          "min-h-12 w-full rounded-card border bg-surface px-4 font-display text-xl text-text placeholder:text-muted",
          valid ? "border-line" : "border-down",
        ].join(" ")}
      />
      <p id={hintId} className={["text-sm", valid ? "text-muted" : "text-down"].join(" ")}>
        {valid
          ? `Between ${amount(market.minSize)} and ${amount(market.maxOrderSize)} ${market.symbol}`
          : `Choose an amount between ${amount(market.minSize)} and ${amount(market.maxOrderSize)} ${market.symbol}`}
      </p>
    </div>
  );
}
