"use client";

import { useMemo, useRef, useState } from "react";

import { BigButton } from "@/components/BigButton";
import { CoinPills } from "@/components/CoinPills";
import { Sheet } from "@/components/Sheet";
import { SideToggle } from "@/components/SideToggle";
import { useToast } from "@/components/Toast";
import { postEnvelope, usePoll } from "@/hooks/usePoll";
import { amount, money } from "@/lib/format";
import type { Market, OrderSide, Price, SignalView } from "@/lib/schemas";
import { tpSlPrices } from "@/lib/signals/math";

type PostIdeaSheetProps = {
  open: boolean;
  onClose: () => void;
  markets: Market[];
  /** Display name used as the author (play name; same testnet key). */
  authorName: string;
  onPosted: (signal: SignalView) => void;
};

const PRICE_POLL_MS = 5000;

export function PostIdeaSheet({ open, onClose, markets, authorName, onPosted }: PostIdeaSheetProps) {
  const { show } = useToast();
  const [author, setAuthor] = useState(authorName);
  const [marketName, setMarketName] = useState(markets[0]?.name ?? "BTC/USD");
  const [side, setSide] = useState<OrderSide>("up");
  const [tpPct, setTpPct] = useState("3");
  const [slPct, setSlPct] = useState("2");
  const [holdHours, setHoldHours] = useState("4");
  const market = markets.find((m) => m.name === marketName) ?? markets[0];
  const [size, setSize] = useState(() => (market ? amount(market.minSize) : ""));
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  const price = usePoll<Price>(open && market ? `/api/price/${encodeURIComponent(market.name)}` : null, PRICE_POLL_MS);
  const mid = price.data?.mid ?? null;

  const preview = useMemo(() => {
    const tp = Number(tpPct);
    const sl = Number(slPct);
    if (mid === null || !Number.isFinite(tp) || !Number.isFinite(sl) || tp <= 0 || sl <= 0) return null;
    return tpSlPrices(side, mid, tp, sl);
  }, [mid, side, tpPct, slPct]);

  const digits = mid !== null && mid >= 100 ? 0 : 2;
  const symbol = market?.symbol ?? "";

  function selectMarket(name: string) {
    setMarketName(name);
    const next = markets.find((m) => m.name === name);
    if (next) setSize(amount(next.minSize));
  }

  async function submit() {
    if (!market || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try {
      const signal = await postEnvelope<SignalView>("/api/signals", {
        author,
        market: market.name,
        side,
        tpPct,
        slPct,
        holdHours,
        size,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      show(`Idea posted: ${signal.author} went ${side === "up" ? "Up" : "Down"} on ${signal.symbol}`, { variant: "success" });
      setNote("");
      onPosted(signal);
      onClose();
    } catch (error) {
      show(error instanceof Error ? error.message : "Something went wrong. Try again.", { variant: "error" });
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Post an idea">
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field label="Your name" hint="A play name — everyone trades from the same testnet account.">
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            maxLength={40}
            className="min-h-12 w-full rounded-card border border-line bg-bg px-4 text-text"
          />
        </Field>

        <CoinPills markets={markets} selected={market?.name ?? ""} onSelect={selectMarket} />

        <p className="font-display text-lg" aria-live="polite">
          Entry = live price: 1 {symbol} ={" "}
          {mid === null ? <span className="text-muted">{price.error ? "price unavailable" : "…"}</span> : `$${money(mid, digits)}`}
        </p>

        <SideToggle value={side} onChange={setSide} />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Take profit %" hint={preview ? `out at $${money(preview.tpPrice, digits)}` : "above entry for Up"}>
            <NumberInput value={tpPct} onChange={setTpPct} />
          </Field>
          <Field label="Stop loss %" hint={preview ? `out at $${money(preview.slPrice, digits)}` : "below entry for Up"}>
            <NumberInput value={slPct} onChange={setSlPct} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Hold for (hours)" hint="1 to 720">
            <NumberInput value={holdHours} onChange={setHoldHours} />
          </Field>
          <Field label={`How much (${symbol})`} hint={market ? `${amount(market.minSize)} to ${amount(market.maxOrderSize)}` : ""}>
            <NumberInput value={size} onChange={setSize} />
          </Field>
        </div>

        <Field label="Why? (optional)" hint="Up to 140 characters">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={140}
            placeholder="BTC looks strong today"
            className="min-h-12 w-full rounded-card border border-line bg-bg px-4 text-text placeholder:text-muted"
          />
        </Field>

        <BigButton type="submit" pending={pending} pendingLabel="Posting…" disabled={mid === null || !author.trim()}>
          Post this idea
        </BigButton>
      </form>
    </Sheet>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-display text-base font-medium">{label}</span>
      {children}
      {hint ? <span className="text-sm text-muted">{hint}</span> : null}
    </label>
  );
}

function NumberInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      inputMode="decimal"
      autoComplete="off"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-12 w-full rounded-card border border-line bg-bg px-4 font-display text-lg text-text"
    />
  );
}
