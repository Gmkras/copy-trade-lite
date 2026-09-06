"use client";

import type { OrderSide } from "@/lib/schemas";

type SideToggleProps = {
  value: OrderSide;
  onChange: (side: OrderSide) => void;
};

/** Two huge buttons: Up or Down. Direction colors are the only place green/red appear besides PnL. */
export function SideToggle({ value, onChange }: SideToggleProps) {
  const options: { side: OrderSide; label: string; hint: string; active: string }[] = [
    { side: "up", label: "Up ↑", hint: "I think the price goes up", active: "border-up text-up" },
    { side: "down", label: "Down ↓", hint: "I think the price goes down", active: "border-down text-down" },
  ];
  return (
    <div role="radiogroup" aria-label="Direction" className="grid grid-cols-2 gap-3">
      {options.map((option) => {
        const active = option.side === value;
        return (
          <button
            key={option.side}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.side)}
            className={[
              "flex min-h-20 flex-col items-center justify-center rounded-card border-2 bg-surface px-3 py-3 transition-colors",
              active ? option.active : "border-line text-muted hover:text-text",
            ].join(" ")}
          >
            <span className="font-display text-2xl font-bold">{option.label}</span>
            <span className="mt-1 text-sm text-muted">{option.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
