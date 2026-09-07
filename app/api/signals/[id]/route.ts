import { apiHandler, NotFoundError } from "@/lib/api";
import { errorText, getCandles, getPrice, humanizeSdkError } from "@/lib/decibel";
import type { Candle, Price, SignalDetail } from "@/lib/schemas";
import { isExpired, signalsRepo } from "@/lib/signals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Four hours of one-minute candles: the detail's default range, at full resolution. */
const CANDLE_WINDOW = { interval: "1m", count: 240 } as const;

/** GET /api/signals/[id] — signal, copies, live price and the last four hours of one-minute candles. */
export const GET = apiHandler<SignalDetail>({
  run: async ({ params }) => {
    const repo = signalsRepo();
    const signal = await repo.getSignal(params.id ?? "");
    if (!signal) throw new NotFoundError("That idea was not found. It may have been posted on another computer.");

    // Price and candles are best-effort: the lines and the copy panel still work without them.
    const [priceResult, candlesResult] = await Promise.allSettled([
      getPrice(signal.market),
      getCandles(signal.market, CANDLE_WINDOW),
    ]);

    let price: Price | null = null;
    let priceError: string | null = null;
    if (priceResult.status === "fulfilled") price = priceResult.value;
    else priceError = humanizeSdkError(priceResult.reason).message;

    let candles: Candle[] = [];
    let candlesError: string | null = null;
    if (candlesResult.status === "fulfilled") candles = candlesResult.value;
    else {
      candlesError = "Couldn't load the price history right now.";
      console.error("[signals] candles failed:", errorText(candlesResult.reason));
    }

    return {
      signal: { ...signal, expired: isExpired(signal) },
      copies: await repo.listCopies(signal.id),
      price,
      priceError,
      candles,
      candlesError,
    };
  },
});
