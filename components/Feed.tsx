"use client";

import { useEffect, useRef, useState } from "react";

import { PostIdeaSheet } from "@/components/PostIdeaSheet";
import { SignalCard } from "@/components/SignalCard";
import { useLive } from "@/hooks/useLive";
import { usePoll } from "@/hooks/usePoll";
import type { Market, SignalList } from "@/lib/schemas";
import { crossedALevel } from "@/lib/signals/math";

type FeedProps = {
  initial: SignalList;
  markets: Market[];
  authorName?: string;
  /** Set when the server could not read the store: shown instead of the empty state. */
  loadError?: string | null;
};

const FEED_POLL_MS = 10_000;
/** While the stream is connected the poll is only a heartbeat. */
const HEARTBEAT_MS = 30_000;
/**
 * A crossing is a hint, not a verdict: the streamed mid can reach a level
 * before any trade prints there, and the server settles from candles built
 * from trades. So an idea that has crossed but is not settled yet is asked
 * about again only after this long — otherwise one unconfirmed crossing would
 * ask on every price tick.
 */
const CROSS_RETRY_MS = 30_000;

/** The social feed: ideas as cards, newest first, plus the Post an idea sheet. */
export function Feed({ initial, markets, authorName = "You", loadError = null }: FeedProps) {
  const live = useLive();
  const feed = usePoll<SignalList>("/api/signals", live.live ? HEARTBEAT_MS : FEED_POLL_MS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const data = feed.data ?? initial;
  const statsByAuthor = new Map(data.authors.map((a) => [a.author, a]));

  // When a streamed price reaches an open idea's level, ask the server to
  // refresh: it settles the outcome from the candles, as it always does. The
  // browser only shortens the wait — it never decides the result (design D5).
  const refresh = feed.refresh;
  const askedAt = useRef(new Map<string, number>());
  useEffect(() => {
    if (!live.live) return;
    const now = Date.now();
    let ask = false;
    for (const signal of data.signals) {
      const price = live.prices[signal.market];
      if (price === undefined || !crossedALevel(signal, price)) continue;
      if (now - (askedAt.current.get(signal.id) ?? 0) < CROSS_RETRY_MS) continue;
      askedAt.current.set(signal.id, now);
      ask = true;
    }
    if (ask) refresh();
  }, [live.live, live.prices, data.signals, refresh]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl">Ideas</h1>
        <div className="flex items-center gap-2">
          {feed.stale ? (
            <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">couldn&apos;t refresh</span>
          ) : (
            <span className={["text-xs", live.live ? "text-up" : "text-muted"].join(" ")}>
              {live.live ? "live" : "refreshing every 10s"}
            </span>
          )}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="min-h-11 rounded-full border border-text px-4 font-display text-base font-medium text-text"
          >
            Post an idea
          </button>
        </div>
      </div>

      {data.signals.length === 0 && loadError ? (
        <div className="rounded-card border border-line bg-surface p-6 text-center">
          <p className="font-display text-lg">Ideas are unavailable</p>
          <p className="mt-1 text-sm text-muted">{loadError}</p>
        </div>
      ) : data.signals.length === 0 ? (
        <div className="rounded-card border border-line bg-surface p-6 text-center">
          <p className="font-display text-lg">No ideas yet — post the first one.</p>
          <p className="mt-1 text-sm text-muted">Say where you think a coin goes; anyone can copy it with one tap.</p>
        </div>
      ) : (
        data.signals.map((signal) => (
          <SignalCard
            key={signal.id}
            signal={signal}
            stats={statsByAuthor.get(signal.author)}
            now={data.updatedAt}
            livePrice={live.prices[signal.market] ?? data.prices[signal.market] ?? null}
            candles={data.candles[signal.market] ?? []}
          />
        ))
      )}

      <PostIdeaSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        markets={markets}
        authorName={authorName}
        onPosted={() => feed.refresh()}
      />
    </div>
  );
}
