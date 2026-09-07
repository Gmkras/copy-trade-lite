"use client";

import { useState, type ReactNode } from "react";

import { Card } from "@/components/Card";
import { amount, money, pct, signedMoney, timeAgo } from "@/lib/format";
import type { AccountState } from "@/lib/schemas";

type AccountCardProps = {
  state: AccountState | null;
  stale: boolean;
  loading: boolean;
  error: string | null;
  /** True while the live stream is connected; false means the timer is doing the work. */
  live?: boolean;
};

/** Equity, Available, PnL in three big numbers; Positions / Orders / Fills as collapsible card lists. */
export function AccountCard({ state, stale, loading, error, live = false }: AccountCardProps) {
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

          <Section title="Positions" count={state.positions.length} defaultOpen>
            {state.positions.length === 0 ? (
              <Empty>No trades yet — try Up on BTC.</Empty>
            ) : (
              state.positions.map((p) => (
                <Row key={p.market + p.side}>
                  <div>
                    <p className="font-display text-base font-medium">
                      {p.symbol} <span className={p.side === "up" ? "text-up" : "text-down"}>{p.side === "up" ? "Up" : "Down"}</span>
                    </p>
                    <p className="text-sm text-muted">
                      {amount(p.size)} {p.symbol} · in at ${money(p.entryPrice, 0)} · now ${money(p.markPrice, 0)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={["font-display text-base font-medium", p.pnlUsd >= 0 ? "text-up" : "text-down"].join(" ")}>
                      {signedMoney(p.pnlUsd)}
                    </p>
                    <p className={["text-sm", p.pnlUsd >= 0 ? "text-up" : "text-down"].join(" ")}>{pct(p.pnlPct)}</p>
                  </div>
                </Row>
              ))
            )}
          </Section>

          <Section title="Open orders" count={state.orders.length}>
            {state.orders.length === 0 ? (
              <Empty>No open orders. Your trades fill right away.</Empty>
            ) : (
              state.orders.map((o, i) => (
                <Row key={`${o.market}-${o.time}-${i}`}>
                  <div>
                    <p className="font-display text-base font-medium">
                      {o.market} <span className={o.side === "up" ? "text-up" : "text-down"}>{o.side === "up" ? "Buy" : "Sell"}</span>
                    </p>
                    <p className="text-sm text-muted">{amount(o.size)} at {o.price === null ? "market" : `$${money(o.price, 0)}`}</p>
                  </div>
                  <p className="text-sm text-muted">{timeAgo(o.time)}</p>
                </Row>
              ))
            )}
          </Section>

          <Section title="Fills" count={state.fills.length}>
            {state.fills.length === 0 ? (
              <Empty>No fills yet. Your first trade will show up here.</Empty>
            ) : (
              state.fills.map((f, i) => (
                <Row key={`${f.market}-${f.time}-${i}`}>
                  <div>
                    <p className="font-display text-base font-medium">
                      {f.market} <span className={f.side === "up" ? "text-up" : "text-down"}>{f.side === "up" ? "Bought" : "Sold"}</span>
                    </p>
                    <p className="text-sm text-muted">
                      {amount(f.size)} at ${money(f.price, 0)} · fee ${money(f.fee, 4)}
                    </p>
                  </div>
                  <p className="text-sm text-muted">{timeAgo(f.time)}</p>
                </Row>
              ))
            )}
          </Section>
        </>
      )}
    </Card>
  );
}

function Stat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-sm text-muted">{label}</p>
      <p className={["font-display text-xl font-bold", className].join(" ")}>{value}</p>
    </div>
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

function Row({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-between gap-3 rounded-card border border-line bg-bg px-3 py-2">{children}</div>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}
