"use client";

import type { ReactNode } from "react";

import { amount, money, pct, signedMoney, timeAgo } from "@/lib/format";
import type { AccountState } from "@/lib/schemas";

/**
 * The account's three lists, and the bits they are built from.
 *
 * Shared by the two containers that show them: `AccountCard`'s collapsible
 * sections below 1024 px, and `PositionsPanel`'s tabs from 1024 px (design
 * D10). The containers differ in more than layout — three independently
 * open-able sections against three mutually exclusive tabs — so what is shared
 * is the rows, not a component with a `layout` prop.
 */

export function Stat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-sm text-muted">{label}</p>
      <p className={["font-display text-xl font-bold", className].join(" ")}>{value}</p>
    </div>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-between gap-3 rounded-card border border-line bg-bg px-3 py-2">{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

export function PositionRows({ positions }: { positions: AccountState["positions"] }) {
  if (positions.length === 0) return <Empty>No trades yet — try Up on BTC.</Empty>;
  return (
    <>
      {positions.map((p) => (
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
      ))}
    </>
  );
}

export function OrderRows({ orders }: { orders: AccountState["orders"] }) {
  if (orders.length === 0) return <Empty>No open orders. Your trades fill right away.</Empty>;
  return (
    <>
      {orders.map((o, i) => (
        <Row key={`${o.market}-${o.time}-${i}`}>
          <div>
            <p className="font-display text-base font-medium">
              {o.market} <span className={o.side === "up" ? "text-up" : "text-down"}>{o.side === "up" ? "Up" : "Down"}</span>
            </p>
            <p className="text-sm text-muted">{amount(o.size)} at {o.price === null ? "market" : `$${money(o.price, 0)}`}</p>
          </div>
          <p className="text-sm text-muted">{timeAgo(o.time)}</p>
        </Row>
      ))}
    </>
  );
}

export function FillRows({ fills }: { fills: AccountState["fills"] }) {
  if (fills.length === 0) return <Empty>No fills yet. Your first trade will show up here.</Empty>;
  return (
    <>
      {fills.map((f, i) => (
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
      ))}
    </>
  );
}
