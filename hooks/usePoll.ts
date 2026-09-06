"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ApiEnvelope } from "@/lib/schemas";

export type PollState<T> = {
  data: T | null;
  /** Last error message (plain language from the API envelope). */
  error: string | null;
  /** True when the last refresh failed but older data is still shown. */
  stale: boolean;
  loading: boolean;
  updatedAt: number | null;
};

export type PollEvent<T> = { type: "success"; data: T; at: number } | { type: "failure"; message: string };

export const initialPollState = <T,>(): PollState<T> => ({
  data: null,
  error: null,
  stale: false,
  loading: true,
  updatedAt: null,
});

/** Pure state transition: keeps the last good data on failure and flags it stale. */
export function pollTransition<T>(state: PollState<T>, event: PollEvent<T>): PollState<T> {
  if (event.type === "success") {
    return { data: event.data, error: null, stale: false, loading: false, updatedAt: event.at };
  }
  return { ...state, error: event.message, stale: state.data !== null, loading: false };
}

/** Fetches an API envelope and unwraps it, turning `ok:false` into an Error with the server's message. */
export async function fetchEnvelope<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store" });
  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    envelope = null;
  }
  if (!envelope) throw new Error(`Unexpected response (${response.status}).`);
  if (!envelope.ok) throw new Error(envelope.message);
  return envelope.data;
}

/** POSTs JSON and unwraps the envelope the same way as `fetchEnvelope`. */
export async function postEnvelope<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    envelope = null;
  }
  if (!envelope) throw new Error(`Unexpected response (${response.status}).`);
  if (!envelope.ok) throw new Error(envelope.message);
  return envelope.data;
}

type Slot<T> = { url: string | null; poll: PollState<T> };

/**
 * Polls a JSON API route every `intervalMs`. Keeps the last good data when a
 * refresh fails (`stale: true`) and exposes `refresh()` for immediate reloads
 * (e.g. right after an order). Pass `null` as url to pause.
 *
 * State is stored together with the url it belongs to, so switching urls
 * shows the initial state without a synchronous setState inside the effect.
 */
export function usePoll<T>(url: string | null, intervalMs: number): PollState<T> & { refresh: () => void } {
  const [slot, setSlot] = useState<Slot<T>>({ url, poll: initialPollState<T>() });
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!url) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const apply = (event: PollEvent<T>) =>
      setSlot((prev) => ({ url, poll: pollTransition(prev.url === url ? prev.poll : initialPollState<T>(), event) }));
    try {
      const data = await fetchEnvelope<T>(url, current.signal);
      if (current.signal.aborted) return;
      apply({ type: "success", data, at: Date.now() });
    } catch (error) {
      if (current.signal.aborted) return;
      apply({ type: "failure", message: error instanceof Error ? error.message : "Couldn't refresh." });
    }
  }, [url]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), intervalMs);
    return () => {
      window.clearInterval(timer);
      controller.current?.abort();
    };
  }, [load, intervalMs]);

  const refresh = useCallback(() => {
    void load();
  }, [load]);

  const poll = slot.url === url ? slot.poll : initialPollState<T>();
  return { ...poll, refresh };
}
