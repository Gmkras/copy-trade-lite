"use client";

import { useRef, useState } from "react";

import { FillRows, OrderRows, PositionRows } from "@/components/AccountRows";
import { Card } from "@/components/Card";
import type { AccountState } from "@/lib/schemas";

type Tab = "positions" | "orders" | "fills";

type PositionsPanelProps = {
  state: AccountState | null;
  loading: boolean;
};

/**
 * Positions / Open orders / Fills as tabs, under the chart on a wide screen.
 *
 * The same rows the account card shows on a phone (`AccountRows`), in the
 * container a trading terminal uses: one list always open, chosen by a tab
 * that carries its count. This is also what fills the band of empty screen the
 * review measured below the fold (design D9, D10).
 */
export function PositionsPanel({ state, loading }: PositionsPanelProps) {
  const [tab, setTab] = useState<Tab>("positions");
  const list = useRef<HTMLDivElement | null>(null);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "positions", label: "Positions", count: state?.positions.length ?? 0 },
    { id: "orders", label: "Open orders", count: state?.orders.length ?? 0 },
    { id: "fills", label: "Fills", count: state?.fills.length ?? 0 },
  ];

  /** Arrow keys move between tabs, as the ARIA tablist pattern expects. */
  function move(delta: number, from: number) {
    const next = tabs[(from + delta + tabs.length) % tabs.length];
    if (!next) return;
    setTab(next.id);
    list.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[(from + delta + tabs.length) % tabs.length]?.focus();
  }

  return (
    <Card className="flex h-full min-h-0 flex-col gap-3">
      <div ref={list} role="tablist" aria-label="Your account" className="flex gap-1 border-b border-line">
        {tabs.map((t, index) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={active}
              aria-controls={`panel-${t.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") {
                  event.preventDefault();
                  move(1, index);
                } else if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  move(-1, index);
                }
              }}
              className={[
                "-mb-px min-h-11 border-b-2 px-3 font-display text-base font-medium transition-colors",
                active ? "border-text text-text" : "border-transparent text-muted hover:text-text",
              ].join(" ")}
            >
              {t.label} <span className={active ? "text-muted" : ""}>({t.count})</span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="flex min-h-0 flex-col gap-2 overflow-y-auto"
      >
        {state === null ? (
          <p className="text-sm text-muted">{loading ? "Loading your account…" : "Your account is unavailable right now."}</p>
        ) : tab === "positions" ? (
          <PositionRows positions={state.positions} />
        ) : tab === "orders" ? (
          <OrderRows orders={state.orders} />
        ) : (
          <FillRows fills={state.fills} />
        )}
      </div>
    </Card>
  );
}
