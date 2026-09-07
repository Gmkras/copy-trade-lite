"use client";

import { useMemo, useState } from "react";

import { Card } from "@/components/Card";
import { CopyPanel } from "@/components/CopyPanel";
import { MarketChart, type ChartLine, type ChartMarker } from "@/components/MarketChart";
import { useToast } from "@/components/Toast";
import { fetchEnvelope, usePoll } from "@/hooks/usePoll";
import { amount, money, timeAgo } from "@/lib/format";
import type { Candle, CandleRange, CandlesResponse, SignalCopy, SignalDetail as SignalDetailData, SignalView } from "@/lib/schemas";
import { describe, groupCopyMarkers, headline, timeLeftLabel } from "@/lib/signals/math";

type SignalDetailProps = {
  initialSignal: SignalView;
  initialCopies: SignalCopy[];
};

const DETAIL_POLL_MS = 10_000;
const LINE_COLORS = { entry: "#f5c400", tp: "#22c55e", sl: "#ef4444" };
/** The detail's own poll carries four hours of one-minute candles. */
const POLLED_RANGE: CandleRange = "4h";

export function SignalDetail({ initialSignal, initialCopies }: SignalDetailProps) {
  const { show } = useToast();
  const detail = usePoll<SignalDetailData>(`/api/signals/${initialSignal.id}`, DETAIL_POLL_MS);
  const signal = detail.data?.signal ?? initialSignal;
  const copies = detail.data?.copies ?? initialCopies;
  const price = detail.data?.price ?? null;
  const now = detail.updatedAt ?? signal.createdAt;
  const digits = signal.entryPrice >= 100 ? 0 : 2;

  // Other ranges are fetched once on request; the polled 4h data stays the default.
  const [range, setRange] = useState<CandleRange>(POLLED_RANGE);
  const [override, setOverride] = useState<{ range: CandleRange; candles: Candle[] } | null>(null);
  const [loading, setLoading] = useState(false);

  async function changeRange(next: CandleRange) {
    setRange(next);
    if (next === POLLED_RANGE || override?.range === next) return;
    setLoading(true);
    try {
      const response = await fetchEnvelope<CandlesResponse>(`/api/candles/${encodeURIComponent(signal.market)}?range=${next}`);
      setOverride({ range: next, candles: response.candles });
    } catch (error) {
      show(error instanceof Error ? error.message : "Couldn't load more history.", { variant: "error" });
      setRange(POLLED_RANGE);
    } finally {
      setLoading(false);
    }
  }

  const polled = detail.data?.candles ?? [];
  const candles = range === POLLED_RANGE ? polled : override?.range === range ? override.candles : polled;

  const lines = useMemo<ChartLine[]>(
    () => [
      { price: signal.entryPrice, label: "Entry", color: LINE_COLORS.entry },
      { price: signal.tpPrice, label: "Take profit", color: LINE_COLORS.tp },
      { price: signal.slPrice, label: "Stop loss", color: LINE_COLORS.sl },
    ],
    [signal.entryPrice, signal.tpPrice, signal.slPrice],
  );
  // One marker per cluster of copies close in time, so labels never overlap.
  const markers = useMemo<ChartMarker[]>(() => groupCopyMarkers(copies), [copies]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-muted">
          {signal.author} {headline(signal)} · {timeAgo(signal.createdAt, now)} ·{" "}
          {signal.expired ? "expired" : `live · ${timeLeftLabel(signal, now)}`}
        </p>
        <h1 className="mt-1 text-2xl leading-tight">{describe(signal)}</h1>
        {signal.note ? <p className="mt-2 text-muted">“{signal.note}”</p> : null}
      </div>

      <Card className="p-2">
        {detail.data === null && detail.loading ? (
          <div className="h-[260px] w-full animate-pulse rounded-card bg-surface motion-reduce:animate-none" aria-hidden />
        ) : candles.length > 0 ? (
          <MarketChart
            candles={candles}
            lines={lines}
            markers={markers}
            variant="full"
            range={range}
            onRangeChange={(next) => void changeRange(next)}
            loading={loading}
            precision={digits}
          />
        ) : (
          <p className="p-4 text-sm text-muted">{detail.data?.candlesError ?? "No price history yet."}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 pb-1 pt-2 text-sm">
          <span><span className="text-yellow">■</span> Entry ${money(signal.entryPrice, digits)}</span>
          <span><span className="text-up">■</span> Take profit ${money(signal.tpPrice, digits)}</span>
          <span><span className="text-down">■</span> Stop loss ${money(signal.slPrice, digits)}</span>
          <span className="ml-auto text-muted">
            {price ? `now $${money(price.mid, digits)}` : detail.data?.priceError ? "price unavailable" : ""}
            {detail.stale ? " · couldn't refresh" : ""}
          </span>
        </div>
      </Card>

      <CopyPanel signal={signal} onCopied={() => detail.refresh()} />

      <Card>
        <h2 className="text-lg">Copied {signal.copyCount}× </h2>
        {copies.length === 0 ? (
          <p className="mt-1 text-sm text-muted">Nobody yet — be the first.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {copies.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-card border border-line bg-bg px-3 py-2 text-sm">
                <span>
                  <span className="font-display font-medium">{c.copier}</span> · {amount(c.size)} {signal.symbol} at about ${money(c.fillPrice, digits)}
                </span>
                <a
                  href={`https://explorer.aptoslabs.com/txn/${c.txHash}?network=testnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="-my-2 inline-flex min-h-11 shrink-0 items-center pl-3 text-yellow underline underline-offset-4"
                >
                  {timeAgo(c.createdAt, now)}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
