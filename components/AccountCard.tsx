"use client";

import { useState, type ReactNode } from "react";

import { FillRows, OrderRows, PositionRows, Stat } from "@/components/AccountRows";
import { Card } from "@/components/Card";
import { money, signedMoney } from "@/lib/format";
import type { AccountState } from "@/lib/schemas";

type AccountCardProps = {
  state: AccountState | null;
  stale: boolean;
  loading: boolean;
  error: string | null;
  /** True while the live stream is connected; false means the timer is doing the work. */
  live?: boolean;
  /**
   * Whether this card also carries the three lists. False on a wide screen,
   * where they move to the tabbed panel under the chart (design D10) and the
   * card keeps only the three numbers in the right rail.
   */
  showLists?: boolean;
};

/** Equity, Available, PnL in three big numbers; Positions / Orders / Fills as collapsible card lists. */
export function AccountCard({ state, stale, loading, error, live = false, showLists = true }: AccountCardProps) {
  const pnl = state?.unrealizedPnl ?? 0;
  const pnlColor = pnl > 0 ? "text-up" : pnl < 0 ? "text-down" : "text-text";

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl">Your account</h2>
        {stale ? (
          <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted" title={error ?? undefined}>
            couldn&apos;t refresh
          </span>
        ) : loading ? (
          <span className="text-xs text-muted">loading…</span>
        ) : (
          // Which mode we are in, in plain words. Never claims to be live while
          // the stream is down.
          <span className={["text-xs", live ? "text-up" : "text-muted"].join(" ")}>
            {live ? "live" : "refreshing every 5s"}
          </span>
        )}
      </div>

      {state === null ? (
        error ? (
          <p className="text-muted">{error}</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {["Equity", "Available", "PnL"].map((label) => (
              <div key={label}>
                <p className="text-sm text-muted">{label}</p>
                <div className="mt-1 h-7 w-20 animate-pulse rounded bg-line motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Equity" value={`$${money(state.equity)}`} />
            <Stat label="Available" value={`$${money(state.available)}`} />
            <Stat label="PnL" value={signedMoney(state.unrealizedPnl)} className={pnlColor} />
          </div>
          {!state.exists ? (
            <p className="text-sm text-muted">No play money yet. Run `pnpm mint` in the terminal to get 1,000 test USDC.</p>
          ) : null}

          {showLists ? (
            <>
              <Section title="Positions" count={state.positions.length} defaultOpen>
                <PositionRows positions={state.positions} />
              </Section>
              <Section title="Open orders" count={state.orders.length}>
                <OrderRows orders={state.orders} />
              </Section>
              <Section title="Fills" count={state.fills.length}>
                <FillRows fills={state.fills} />
              </Section>
            </>
          ) : null}
        </>
      )}
    </Card>
  );
}

function Section({ title, count, defaultOpen = false, children }: { title: string; count: number; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-line pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between text-left"
      >
        <span className="font-display text-base font-medium">
          {title} <span className="text-muted">({count})</span>
        </span>
        <span className="text-muted">{open ? "−" : "+"}</span>
      </button>
      {open ? <div className="mt-2 flex flex-col gap-2">{children}</div> : null}
    </div>
  );
}
