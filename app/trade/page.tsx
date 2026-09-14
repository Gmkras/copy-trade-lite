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
    // On a desk the page is exactly the viewport minus the top nav (h-16), and
    // TradeScreen grows into what is left — so the grid never has to guess at
    // header and padding heights. Everywhere else the page scrolls as before.
    //
    // `desk:flex-none` matters: `flex-1` sets flex-basis 0 along the main axis,
    // which overrides the height property, and main grew to its content (973 px
    // instead of 836) until this turned the growing off.
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-6 lg:max-w-6xl desk:h-[calc(100dvh-4rem)] desk:min-h-0 desk:max-w-none desk:flex-none desk:gap-3 desk:overflow-hidden desk:px-4">
      {/* A terminal has no page title; the heading stays for screen readers. */}
      <h1 className="text-3xl desk:sr-only">Trade</h1>
      {problem ? <p className="text-muted">{problem}</p> : <TradeScreen markets={markets} />}
    </main>
  );
}
