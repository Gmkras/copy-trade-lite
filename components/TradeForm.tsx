"use client";

import { useMemo, useRef, useState } from "react";

import { BigButton } from "@/components/BigButton";
import { CoinPills } from "@/components/CoinPills";
import { MarketChart, type ChartLine, type ChartMarker } from "@/components/MarketChart";
import { PasscodeSheet } from "@/components/PasscodeSheet";
import { SideToggle } from "@/components/SideToggle";
import { SizePicker, sizeChips } from "@/components/SizePicker";
import { useToast } from "@/components/Toast";
import { useDemoPasscode } from "@/hooks/useDemoPasscode";
import { postEnvelope, usePoll } from "@/hooks/usePoll";
import { rangeChange, rangeLabel } from "@/lib/charts";
import { amount, money } from "@/lib/format";
import type { CandleRange, CandlesResponse, Market, OrderReceipt, OrderSide, Price } from "@/lib/schemas";

type TradeFormProps = {
  markets: Market[];
  /** Called after a successful order so the account card can refresh immediately. */
  onOrderPlaced?: () => void;
};

const PRICE_POLL_MS = 5000;
const CANDLES_POLL_MS = 15_000;
/** Measured, not estimated: 110 px is what keeps the yellow button above the fold at 375 × 812 (design D6). */
const TRADE_CHART_HEIGHT = 110;
/** Stable empty lists: fresh arrays each render would rebuild the chart on every poll. */
const NO_LINES: ChartLine[] = [];
const NO_MARKERS: ChartMarker[] = [];

export function TradeForm({ markets, onOrderPlaced }: TradeFormProps) {
  const { show } = useToast();
  const { run, prompt } = useDemoPasscode();
  const [marketName, setMarketName] = useState(markets[0]?.name ?? "BTC/USD");
  const [side, setSide] = useState<OrderSide>("up");
  const market = markets.find((m) => m.name === marketName) ?? markets[0];
  const [sizeText, setSizeText] = useState(() => (market ? amount(sizeChips(market)[0] ?? market.minSize) : ""));
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  const price = usePoll<Price>(market ? `/api/price/${encodeURIComponent(market.name)}` : null, PRICE_POLL_MS);
  const mid = price.data?.mid ?? null;

  const [range, setRange] = useState<CandleRange>("1h");
  const candles = usePoll<CandlesResponse>(
    market ? `/api/candles/${encodeURIComponent(market.name)}?range=${range}` : null,
    CANDLES_POLL_MS,
  );
  const shownCandles = candles.data?.candles ?? [];
  const change = rangeChange(shownCandles);

  const size = Number(sizeText);
  const sizeValid = useMemo(() => {
    if (!market) return false;
    return Number.isFinite(size) && size >= market.minSize && size <= market.maxOrderSize;
  }, [market, size]);

  const canSubmit = Boolean(market) && sizeValid && mid !== null && !pending;
  const verb = side === "up" ? "Buy" : "Sell";
  const label =
    market && sizeValid && mid !== null
      ? `${verb} ${amount(size)} ${market.symbol} ≈ $${money(size * mid)}`
      : market && !sizeValid
        ? "Choose a valid amount"
        : "Waiting for price…";

  function selectMarket(name: string) {
    setMarketName(name);
    const next = markets.find((m) => m.name === name);
    if (next) setSizeText(amount(sizeChips(next)[0] ?? next.minSize));
  }

  async function submit() {
    if (!market || !canSubmit || inFlight.current) return; // ref guard: a double tap never sends twice
    inFlight.current = true;
    setPending(true);
    try {
      const receipt = await run((passcode) => fetchOrder({ market: market.name, side, size }, passcode));
      show(`Order sent: ${verb.toLowerCase()} ${amount(receipt.size)} ${market.symbol} at about $${money(receipt.referencePrice)}`, {
        variant: "success",
        link: { href: receipt.explorerUrl, label: "See it on the explorer" },
      });
      onOrderPlaced?.();
    } catch (error) {
      show(error instanceof Error ? error.message : "Something went wrong. Try again.", { variant: "error" });
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  if (!market) {
    return <p className="text-muted">No markets are open right now. Try again in a moment.</p>;
  }

  return (
    <>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <CoinPills markets={markets} selected={market.name} onSelect={selectMarket} />

        <div className="flex flex-col gap-1.5">
          <p className="font-display leading-tight" aria-live="polite">
            <span className="text-sm text-muted">1 {market.symbol} = </span>
            <span className="text-2xl font-bold">
              {mid === null ? <span className="text-muted">{price.error ? "price unavailable" : "…"}</span> : `$${money(mid, market.priceStep >= 1 ? 0 : 2)}`}
            </span>
            {change ? (
              <span className={["ml-2 whitespace-nowrap text-sm", change.abs >= 0 ? "text-up" : "text-down"].join(" ")}>
                {change.abs >= 0 ? "+" : "−"}{Math.abs(change.pct).toFixed(2)}% · {rangeLabel(range)}
              </span>
            ) : null}
            {price.stale ? <span className="ml-2 rounded-full border border-line px-2 text-xs text-muted">couldn&apos;t refresh</span> : null}
          </p>
          {shownCandles.length > 1 ? (
            <MarketChart
              candles={shownCandles}
              lines={NO_LINES}
              markers={NO_MARKERS}
              variant="full"
              compact
              range={range}
              onRangeChange={setRange}
              loading={candles.loading}
              height={TRADE_CHART_HEIGHT}
              precision={market.priceStep >= 1 ? 0 : 2}
            />
          ) : (
            <div className="flex h-[110px] items-center justify-center rounded-card border border-line text-sm text-muted" aria-live="polite">
              {candles.loading ? "Loading the chart…" : `No price history for ${market.symbol} right now.`}
            </div>
          )}
        </div>

        <SideToggle value={side} onChange={setSide} />

        <SizePicker market={market} value={sizeText} onChange={setSizeText} valid={sizeValid} />

        <BigButton type="submit" disabled={!canSubmit} pending={pending} pendingLabel="Sending your order…">
          {label}
        </BigButton>
        <p className="text-center text-sm text-muted">Play money on Aptos testnet. Nothing here is real.</p>
      </form>
      <PasscodeSheet {...prompt} />
    </>
  );
}

function fetchOrder(body: { market: string; side: OrderSide; size: number }, passcode: string | null): Promise<OrderReceipt> {
  return postEnvelope<OrderReceipt>("/api/order", body, passcode);
}
