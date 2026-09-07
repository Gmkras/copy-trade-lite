import { Feed } from "@/components/Feed";
import { listMarkets } from "@/lib/decibel";
import type { Market, SignalList } from "@/lib/schemas";
import { isExpired, signalsRepo } from "@/lib/signals";

export const dynamic = "force-dynamic";

/** Reads the feed straight from the database (not a component, so it may read the clock). */
async function loadFeed(): Promise<SignalList> {
  const repo = signalsRepo();
  const now = Date.now();
  const [signals, authors] = await Promise.all([repo.listSignals(), repo.authorStats()]);
  return {
    signals: signals.map((s) => ({ ...s, expired: isExpired(s, now) })),
    authors,
    updatedAt: now,
  };
}

const EMPTY_FEED: SignalList = { signals: [], authors: [], updatedAt: 0 };

/** Home = the ideas feed. First paint comes from the server; the client polls after that. */
export default async function Home() {
  let initial = EMPTY_FEED;
  let feedError: string | null = null;
  try {
    initial = await loadFeed();
  } catch (error) {
    // The database is unreachable. Say so plainly; never show the URL or the stack.
    console.error("[feed] could not read the signal store:", error);
    feedError = "We couldn't load the ideas right now. The trade screen still works — try the feed again in a moment.";
  }

  let markets: Market[] = [];
  try {
    markets = await listMarkets();
  } catch (error) {
    console.error("[feed] could not load markets:", error);
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-6">
      <Feed initial={initial} markets={markets} loadError={feedError} />
    </main>
  );
}
