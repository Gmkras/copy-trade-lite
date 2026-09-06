import { Feed } from "@/components/Feed";
import { listMarkets } from "@/lib/decibel";
import type { Market, SignalList } from "@/lib/schemas";
import { isExpired, signalsRepo } from "@/lib/signals";

export const dynamic = "force-dynamic";

/** Reads the feed straight from SQLite (not a component, so it may read the clock). */
function loadFeed(): SignalList {
  const repo = signalsRepo();
  const now = Date.now();
  return {
    signals: repo.listSignals().map((s) => ({ ...s, expired: isExpired(s, now) })),
    authors: repo.authorStats(),
    updatedAt: now,
  };
}

/** Home = the ideas feed. First paint comes from the server; the client polls after that. */
export default async function Home() {
  const initial = loadFeed();

  let markets: Market[] = [];
  try {
    markets = await listMarkets();
  } catch (error) {
    console.error("[feed] could not load markets:", error);
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-6">
      <Feed initial={initial} markets={markets} />
    </main>
  );
}
