"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { SLOT_MS, deliver, type Delivery } from "@/lib/learn/simulate";

const UPDATES = 12;
const SEED = 7;

type Lane = { id: "tcp" | "udp"; label: string; note: string; plan: Delivery };

/**
 * Two lanes, the same losses, one timer.
 *
 * Both lanes walk a plan computed up front by `deliver()` with the same seed,
 * so they are losing the *same* packets — otherwise the comparison would be
 * between two different runs. One `setInterval` advances both, because two
 * would drift and the point is to see them at the same instant (design D4).
 */
export function PacketRace() {
  const [loss, setLoss] = useState(25);
  const [slot, setSlot] = useState(0);
  const [running, setRunning] = useState(false);
  const timer = useRef<number | null>(null);

  const lanes = useMemo<Lane[]>(
    () => [
      {
        id: "tcp",
        label: "TCP",
        note: "guaranteed, in order — a loss stalls everything behind it",
        plan: deliver(UPDATES, loss, "tcp", SEED),
      },
      {
        id: "udp",
        label: "UDP",
        note: "best effort — a loss is simply gone, nothing waits",
        plan: deliver(UPDATES, loss, "udp", SEED),
      },
    ],
    [loss],
  );

  // The run is over when the slowest lane has used all its slots.
  const totalSlots = Math.max(...lanes.map((l) => l.plan.arrived.length + l.plan.stalls));

  useEffect(() => {
    if (!running) return;
    timer.current = window.setInterval(() => {
      setSlot((s) => {
        if (s >= totalSlots) {
          setRunning(false);
          return s;
        }
        return s + 1;
      });
    }, SLOT_MS);
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current);
      timer.current = null;
    };
  }, [running, totalSlots]);

  function start() {
    // Someone who asked for less motion gets the answer, not the animation.
    // Decided here rather than inside the effect: it is a property of this
    // click, not something the page needs to stay synchronised with.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRunning(false);
      setSlot(totalSlots);
      return;
    }
    setSlot(0);
    setRunning(true);
  }

  const finished = slot >= totalSlots && !running;

  return (
    <section aria-label="TCP against UDP" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex flex-1 flex-col gap-1">
          <span className="flex items-baseline justify-between text-sm">
            <span className="text-muted">Packet loss</span>
            <span className="font-display tabular-nums text-text">{loss}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={60}
            step={5}
            value={loss}
            onChange={(e) => {
              setLoss(Number(e.target.value));
              setSlot(0);
              setRunning(false);
            }}
            aria-label="Packet loss percentage"
            className="h-11 w-full accent-[#f5f5f4]"
          />
        </label>
        <button
          type="button"
          onClick={start}
          className="min-h-11 shrink-0 rounded-full border border-text bg-text px-4 font-display text-sm font-medium text-bg"
        >
          {running ? "Sending…" : "Send 12 prices"}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {lanes.map((lane) => {
          const shown = lane.plan.arrived.filter((_, index) => index < slot);
          return (
            <div key={lane.id} className="rounded-card border border-line bg-surface p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h4 className="font-display font-medium text-text">{lane.label}</h4>
                <p className="text-xs text-muted">{lane.note}</p>
              </div>
              <ol className="mt-2 flex flex-wrap gap-1" aria-label={`${lane.label} arrivals`}>
                {Array.from({ length: UPDATES }, (_, n) => {
                  const here = shown.includes(n);
                  const lost = slot >= totalSlots && !lane.plan.arrived.includes(n);
                  return (
                    <li
                      key={n}
                      className={[
                        "flex size-7 items-center justify-center rounded border font-mono text-xs tabular-nums",
                        here ? "border-up/50 bg-bg text-up" : lost ? "border-down/40 text-down/60" : "border-line text-muted",
                      ].join(" ")}
                    >
                      {lost ? "×" : n + 1}
                    </li>
                  );
                })}
              </ol>
              <p className="mt-2 text-sm">
                <span className="text-muted">arrived </span>
                <span className="font-display tabular-nums text-text">
                  {finished ? lane.plan.arrived.length : shown.length}/{UPDATES}
                </span>
                <span className="text-muted"> · newest is </span>
                <span className="font-display tabular-nums text-text">
                  {finished ? lane.plan.newestAgeMs : 0} ms
                </span>
                <span className="text-muted"> old</span>
                {lane.plan.stalls > 0 ? (
                  <span className="text-muted"> · stalled {lane.plan.stalls}×</span>
                ) : null}
              </p>
            </div>
          );
        })}
      </div>

      {finished ? (
        <p aria-live="polite" className="rounded-card border border-line bg-surface px-3 py-2 text-sm">
          Which one do you want for a <span className="text-text">price</span>, and which for an{" "}
          <span className="text-text">order</span>? This app sends orders over TCP, because one that arrives twice is a
          financial bug — and it treats prices the UDP way inside a TCP pipe: <code className="font-mono text-xs">useLive</code>{" "}
          keeps only the newest mid per market and drops everything in between.
        </p>
      ) : null}
    </section>
  );
}
