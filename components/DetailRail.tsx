"use client";

import { Card } from "@/components/Card";
import { SignalDetail } from "@/components/SignalDetail";
import { useMediaQuery, WIDE } from "@/hooks/useMediaQuery";
import type { SignalList } from "@/lib/schemas";

/**
 * The feed's second column on wide screens: the newest live idea, on its full
 * chart with its copy panel, so browsing and copying happen on one screen.
 *
 * It renders nothing below 1024 px — and therefore fetches nothing there,
 * because `SignalDetail`'s poll only exists while it is mounted.
 */
export function DetailRail({ feed }: { feed: SignalList }) {
  const wide = useMediaQuery(WIDE);
  if (!wide) return null;

  const signal = feed.signals.find((s) => !s.expired) ?? feed.signals[0];
  if (!signal) {
    return (
      <Card className="text-center">
        <p className="font-display text-lg">Pick an idea to see it here</p>
        <p className="mt-1 text-sm text-muted">Post the first one and its chart opens right next to the list.</p>
      </Card>
    );
  }

  return <SignalDetail key={signal.id} initialSignal={signal} initialCopies={[]} />;
}
