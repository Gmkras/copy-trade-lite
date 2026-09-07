"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The live half of the app: prices as they happen, and a nudge when the
 * account changes.
 *
 * It sits beside `usePoll`, it never replaces it. While `live` is true the
 * callers slow their polls to a heartbeat; the moment the stream drops, `live`
 * goes false and the polls carry the screen exactly as they do today. So the
 * fallback is not new code — it is the code that already runs.
 */

export type LivePrices = Record<string, number>;

export type LiveState = {
  /** True once the stream is open and sending. */
  live: boolean;
  /** Latest mid per market name, from the stream only. */
  prices: LivePrices;
  /** Increments whenever the server says the account changed. */
  accountVersion: number;
};

/** A raw SSE payload turned into a price, or null when it is not one we trust. */
export function parsePriceEvent(raw: string): { market: string; mid: number } | null {
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return null;
    const { market, mid } = data as { market?: unknown; mid?: unknown };
    if (typeof market !== "string" || market.length === 0) return null;
    if (typeof mid !== "number" || !Number.isFinite(mid) || mid <= 0) return null;
    return { market, mid };
  } catch {
    return null; // malformed frame: ignore it, never throw inside an event handler
  }
}

/** Newest wins per market; anything unusable leaves the map untouched. */
export function applyPrice(prices: LivePrices, price: { market: string; mid: number } | null): LivePrices {
  if (!price) return prices;
  if (prices[price.market] === price.mid) return prices; // no change, no render
  return { ...prices, [price.market]: price.mid };
}

/**
 * Opens `GET /api/stream` and keeps its latest state.
 *
 * Prices arrive dozens of times per second, so they are collected in a ref and
 * flushed once per animation frame: a burst becomes one render.
 */
/**
 * How long a gap may last before we stop calling ourselves live. The route
 * closes its own window on a timer and `EventSource` reconnects a few seconds
 * later, so a brief silence is normal operation — announcing "not live" every
 * time would be as misleading as the opposite.
 */
const GRACE_MS = 8_000;

export function useLive(enabled = true): LiveState {
  const [state, setState] = useState<LiveState>({ live: false, prices: {}, accountVersion: 0 });
  const pending = useRef<LivePrices>({});
  const frame = useRef<number | null>(null);
  const grace = useRef<number | null>(null);

  const flush = useCallback(() => {
    frame.current = null;
    const batch = pending.current;
    pending.current = {};
    if (Object.keys(batch).length === 0) return;
    setState((current) => ({ ...current, live: true, prices: { ...current.prices, ...batch } }));
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof EventSource === "undefined") return;

    const source = new EventSource("/api/stream");

    const cancelGrace = () => {
      if (grace.current !== null) window.clearTimeout(grace.current);
      grace.current = null;
    };

    const onHello = () => {
      cancelGrace();
      setState((current) => (current.live ? current : { ...current, live: true }));
    };
    const onPrice = (event: MessageEvent<string>) => {
      const price = parsePriceEvent(event.data);
      if (!price) return;
      cancelGrace();
      pending.current[price.market] = price.mid;
      if (frame.current === null) frame.current = window.requestAnimationFrame(flush);
    };
    const onAccount = () => {
      cancelGrace();
      setState((current) => ({ ...current, live: true, accountVersion: current.accountVersion + 1 }));
    };
    // `error` also fires during the routine reconnect that follows our own
    // window closing, so wait out the grace period before saying we are not
    // live. If events come back first, nothing changes on screen.
    const onError = () => {
      if (grace.current !== null) return;
      grace.current = window.setTimeout(() => {
        grace.current = null;
        setState((current) => (current.live ? { ...current, live: false } : current));
      }, GRACE_MS);
    };

    source.addEventListener("hello", onHello);
    source.addEventListener("price", onPrice as EventListener);
    source.addEventListener("account", onAccount);
    source.addEventListener("error", onError);

    return () => {
      source.removeEventListener("hello", onHello);
      source.removeEventListener("price", onPrice as EventListener);
      source.removeEventListener("account", onAccount);
      source.removeEventListener("error", onError);
      source.close();
      cancelGrace();
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      frame.current = null;
      pending.current = {};
    };
  }, [enabled, flush]);

  return state;
}
