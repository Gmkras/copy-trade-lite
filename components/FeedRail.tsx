"use client";

import { SignalCard } from "@/components/SignalCard";
import { useLive } from "@/hooks/useLive";
import { useMediaQuery, WIDE } from "@/hooks/useMediaQuery";
import { usePoll } from "@/hooks/usePoll";
import type { SignalList } from "@/lib/schemas";

const FEED_POLL_MS = 10_000;
const HEARTBEAT_MS = 30_000;

/**
 * The detail screen's first column on wide screens: the same idea cards as
 * the feed, so a reader can jump between ideas without going back.
 *
 * Below 1024 px it renders nothing and, because `usePoll` pauses on a `null`
 * url, it makes no request at all (spec: "Phone pays nothing for the wide
 * layout").
 */
export function FeedRail({ currentId }: { currentId: string }) {
  const wide = useMediaQuery(WIDE);
  const live = useLive(wide);
  const feed = usePoll<SignalList>(wide ? "/api/signals" : null, live.live ? HEARTBEAT_MS : FEED_POLL_MS);
  if (!wide) return null;

  const data = feed.data;
  if (!data) {
    return <div className="h-64 w-full animate-pulse rounded-card bg-surface motion-reduce:animate-none" aria-hidden />;
  }

  const statsByAuthor = new Map(data.authors.map((a) => [a.author, a]));

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl">All ideas</h2>
      {data.signals.map((signal) => (
        <div key={signal.id} className={signal.id === currentId ? "rounded-card ring-2 ring-yellow" : undefined}>
          <SignalCard
            signal={signal}
            stats={statsByAuthor.get(signal.author)}
            now={data.updatedAt}
            livePrice={live.prices[signal.market] ?? data.prices[signal.market] ?? null}
            candles={data.candles[signal.market] ?? []}
          />
        </div>
      ))}
    </div>
  );
}
