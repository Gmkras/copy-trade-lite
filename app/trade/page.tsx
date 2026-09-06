import { TradeScreen } from "@/components/TradeScreen";
import { listMarkets } from "@/lib/decibel";
import type { Market } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/** Markets are read on the server once per page load; prices and the account poll from the client. */
export default async function TradePage() {
  let markets: Market[] = [];
  let problem: string | null = null;
  try {
    markets = await listMarkets();
  } catch (error) {
    console.error("[trade] could not load markets:", error);
    problem = "Couldn't load the coin list from the exchange. Refresh in a moment.";
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 p-6">
      <h1 className="text-3xl">Trade</h1>
      {problem ? <p className="text-muted">{problem}</p> : <TradeScreen markets={markets} />}
    </main>
  );
}
