"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type SeriesType,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

import { countdownLabel, rangeToInterval, splitLevels } from "@/lib/charts";
import { money } from "@/lib/format";
import type { Candle, CandleRange } from "@/lib/schemas";

export type ChartLine = { price: number; label: string; color: string };
export type ChartMarker = { time: number; label: string };
export type ChartType = "candles" | "line" | "area";

export type MarketChartProps = {
  candles: Candle[];
  lines: ChartLine[];
  markers: ChartMarker[];
  /** card: quiet (no grid, last price only); full: grid and both axes. */
  variant: "card" | "full";
  range: CandleRange;
  onRangeChange: (range: CandleRange) => void;
  /** True while a new range is being fetched: the chart dims but stays interactive. */
  loading?: boolean;
  /** Smaller toolbar chips (default on cards); the Trade screen uses it to stay above the fold. */
  compact?: boolean;
  height?: number;
  /** Decimals on the price axis (0 for BTC-like prices, 2 for small ones). */
  precision?: number;
};

const COLORS = {
  bg: "#0b0b0c",
  line: "#26262a",
  muted: "#9a9a9f",
  text: "#f5f5f4",
  up: "#22c55e",
  down: "#ef4444",
  yellow: "#f5c400",
};

const TYPES: { id: ChartType; label: string }[] = [
  { id: "candles", label: "Candles" },
  { id: "line", label: "Line" },
  { id: "area", label: "Area" },
];
const RANGES: CandleRange[] = ["1h", "4h", "1d", "1w"];

/** The chart type is a browser preference shared by every chart (design D4). */
const TYPE_KEY = "chart.type";
function readStoredType(): ChartType {
  try {
    const value = window.localStorage.getItem(TYPE_KEY);
    return value === "line" || value === "area" || value === "candles" ? value : "candles";
  } catch {
    return "candles";
  }
}
function writeStoredType(type: ChartType): void {
  try {
    window.localStorage.setItem(TYPE_KEY, type);
  } catch {
    // Not remembering the type only means asking again next visit.
  }
}

/**
 * TradingView lightweight-charts v5 with the app's toolbar: chart type,
 * range and zoom, the same on every screen. Client-only (<canvas>); loaded
 * through MarketChart.tsx with `ssr: false`.
 */
export default function MarketChartInner({
  candles,
  lines,
  markers,
  variant,
  range,
  onRangeChange,
  loading = false,
  compact = variant === "card",
  height = 260,
  precision = 2,
}: MarketChartProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [type, setType] = useState<ChartType>(readStoredType);

  // A level far outside the candles' own range is left off the price scale
  // rather than stretching it until the candles are a flat line (design D5).
  // The caption says where it went, so nothing is silently dropped.
  const levels = useMemo(() => splitLevels(candles, lines), [candles, lines]);

  // The bar under the pointer, as a timestamp in seconds; null means the
  // pointer is away and the readout shows the most recent bar instead.
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const reading = useMemo(() => {
    const latest = candles[candles.length - 1] ?? null;
    if (hoverTime === null) return latest;
    return candles.find((c) => Math.floor(c.t / 1000) === hoverTime) ?? latest;
  }, [candles, hoverTime]);

  // The clock for the bar countdown. Full-size charts only: a second-by-second
  // render on every feed card would be a dozen renders a second for a number
  // nobody is reading there.
  const full = variant === "full";
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!full) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [full]);

  const lastCandle = candles[candles.length - 1];
  const countdown = full && lastCandle ? countdownLabel(lastCandle.t + rangeToInterval(range).intervalMs - nowMs) : null;

  function chooseType(next: ChartType) {
    setType(next);
    writeStoredType(next);
  }

  useEffect(() => {
    const el = container.current;
    if (!el || candles.length === 0) return;
    const card = variant === "card";

    const chart = createChart(el, {
      width: el.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: COLORS.bg },
        textColor: COLORS.muted,
        fontFamily: "Inter, system-ui, sans-serif",
        attributionLogo: false,
      },
      localization: { priceFormatter: (price: number) => money(price, precision) },
      grid: { vertLines: { visible: !card, color: COLORS.line }, horzLines: { visible: !card, color: COLORS.line } },
      // The bottom fifth is reserved for volume on full-size charts, so the
      // price series stops above it instead of drawing through the bars.
      rightPriceScale: {
        borderColor: COLORS.line,
        scaleMargins: { top: 0.12, bottom: variant === "full" ? 0.24 : 0.12 },
      },
      timeScale: { borderColor: COLORS.line, timeVisible: true, secondsVisible: false },
      crosshair: { horzLine: { color: COLORS.muted }, vertLine: { color: COLORS.muted } },
      handleScroll: { vertTouchDrag: false },
      handleScale: { pinch: true, mouseWheel: true, axisPressedMouseMove: true },
    });
    chartRef.current = chart;

    // Keep the levels that belong on the scale inside the visible price range.
    const linePrices = levels.inScale.map((l) => l.price);
    const autoscaleInfoProvider = (original: () => { priceRange: { minValue: number; maxValue: number } } | null) => {
      const base = original();
      if (!base || linePrices.length === 0) return base;
      return {
        ...base,
        priceRange: {
          minValue: Math.min(base.priceRange.minValue, ...linePrices),
          maxValue: Math.max(base.priceRange.maxValue, ...linePrices),
        },
      };
    };
    const priceFormat = { type: "price" as const, precision, minMove: 1 / 10 ** precision };
    const first = candles[0] as Candle;
    const last = candles[candles.length - 1] as Candle;
    const trend = last.c >= first.o ? COLORS.up : COLORS.down;

    let series: ISeriesApi<SeriesType>;
    if (type === "candles") {
      series = chart.addSeries(CandlestickSeries, {
        upColor: COLORS.up,
        downColor: COLORS.down,
        wickUpColor: COLORS.up,
        wickDownColor: COLORS.down,
        borderVisible: false,
        priceFormat,
        autoscaleInfoProvider,
      });
      series.setData(candles.map((c) => ({ time: toTime(c.t), open: c.o, high: c.h, low: c.l, close: c.c })));
    } else if (type === "line") {
      series = chart.addSeries(LineSeries, { color: COLORS.text, lineWidth: 2, priceFormat, autoscaleInfoProvider });
      series.setData(candles.map((c) => ({ time: toTime(c.t), value: c.c })));
    } else {
      series = chart.addSeries(AreaSeries, {
        lineColor: trend,
        topColor: `${trend}66`,
        bottomColor: `${trend}00`,
        lineWidth: 2,
        priceFormat,
        autoscaleInfoProvider,
      });
      series.setData(candles.map((c) => ({ time: toTime(c.t), value: c.c })));
    }

    // Levels carry a price on the axis and nothing else: their names live in
    // the caption under the chart (design D3). A price line's `title` is drawn
    // as part of its axis label in lightweight-charts, so a name here competes
    // with the scale's own ticks — that is what put "Take profit" on top of a
    // tick on the detail screen. Moving the names out removes the cause, and
    // with it the whole label-collision rule this block used to need.
    for (const line of levels.inScale) {
      series.createPriceLine({
        price: line.price,
        color: line.color,
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: "",
      });
    }

    if (markers.length > 0) {
      const times = candles.map((c) => toTime(c.t) as number);
      const seriesMarkers: SeriesMarker<Time>[] = markers
        .map((m) => ({
          // Markers must sit on a bar: the last bar at or before the copy time.
          time: snapToBar(times, Math.floor(m.time / 1000)) as UTCTimestamp,
          position: "belowBar" as const,
          color: COLORS.yellow,
          shape: "arrowUp" as const,
          // No text. lightweight-charts offers no horizontal alignment for
          // marker text, so a marker on an early bar has its label clipped by
          // the plot's edge (observed as "u copied"). The names go to the
          // caption, which has room for them (design D4).
        }))
        .sort((a, b) => (a.time as number) - (b.time as number));
      createSeriesMarkers(series, seriesMarkers);
    }

    // Volume on its OWN price scale, confined to the bottom fifth (design D7).
    // On the price scale, figures in the tens of thousands would crush the
    // price series into a line — the very defect the autoscale rule above
    // exists to prevent. Full-size charts only: a 170 px card has no room.
    if (variant === "full") {
      const volume = chart.addSeries(HistogramSeries, {
        priceScaleId: "volume",
        priceFormat: { type: "volume" },
        priceLineVisible: false,
        lastValueVisible: false,
      });
      chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
      volume.setData(
        candles.map((c) => ({
          time: toTime(c.t),
          value: Number.isFinite(c.v) ? c.v : 0,
          color: c.c >= c.o ? `${COLORS.up}66` : `${COLORS.down}66`,
        })),
      );
    }

    chart.timeScale().fitContent();

    // How tall the price series actually draws, in pixels: the same kind of
    // diagnostic as `data-visible-bars` below, so "the volume did not squash
    // the price" is a measurement rather than an opinion.
    const highest = Math.max(...candles.map((c) => c.h));
    const lowest = Math.min(...candles.map((c) => c.l));
    const topY = series.priceToCoordinate(highest);
    const bottomY = series.priceToCoordinate(lowest);
    if (topY !== null && bottomY !== null) el.dataset.priceSpan = String(Math.round(Math.abs(bottomY - topY)));

    // How many bars are on screen, readable by tests and assistive tooling.
    chart.timeScale().subscribeVisibleLogicalRangeChange((visible) => {
      if (visible) el.dataset.visibleBars = String(Math.round(visible.to - visible.from));
    });

    // Only the bar's TIME is kept, never the bar itself: the effect re-runs on
    // every candle refresh, so holding the values here would reset the reading
    // under the user's pointer every 15 s (design D6). `undefined` means the
    // pointer left the plot, which falls back to the most recent bar.
    chart.subscribeCrosshairMove((param) => {
      setHoverTime(typeof param.time === "number" ? param.time : null);
    });

    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth });
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, levels, markers, height, precision, variant, type]);

  // Zoom acts on the logical range, anchored on the most recent bars (design D3).
  function zoom(factor: number) {
    const timeScale = chartRef.current?.timeScale();
    const current = timeScale?.getVisibleLogicalRange();
    if (!timeScale || !current) return;
    const span = Math.max(5, (current.to - current.from) * factor);
    timeScale.setVisibleLogicalRange({ from: Math.max(-0.5, current.to - span), to: current.to });
  }
  function resetZoom() {
    chartRef.current?.timeScale().fitContent();
  }

  const chip = (active: boolean) =>
    [
      "rounded-full border font-display font-medium transition-colors",
      compact ? "min-h-7 px-2.5 text-xs" : "min-h-11 px-3 text-sm",
      active ? "border-text bg-text text-bg" : "border-line text-muted hover:text-text",
    ].join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      {/* Controls above the canvas, as every terminal puts them: below the
          chart the time axis is no longer the lowest thing you read. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* A card carries the range chips and nothing else. Ten controls per
            card is a wall of buttons on a screen whose job is "read an idea at
            a glance"; the full charts keep the type and the zoom buttons, and
            pinch and scroll still zoom a card. */}
        {full ? (
          <div role="group" aria-label="Chart type" className="flex gap-1">
            {TYPES.map((t) => (
              <button key={t.id} type="button" aria-pressed={type === t.id} onClick={() => chooseType(t.id)} className={chip(type === t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        ) : null}
        <div role="group" aria-label="Range" className="flex gap-1">
          {RANGES.map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => onRangeChange(r)} className={chip(range === r)}>
              {r}
            </button>
          ))}
        </div>
        {countdown ? (
          <span className="whitespace-nowrap text-xs text-muted" aria-label="Time until this bar closes">
            bar closes in <span className="tabular-nums text-text">{countdown}</span>
          </span>
        ) : null}
        {full ? (
          <div role="group" aria-label="Zoom" className="ml-auto flex gap-1">
            <button type="button" aria-label="Zoom out" onClick={() => zoom(1.6)} className={chip(false)}>
              −
            </button>
            <button type="button" aria-label="Zoom in" onClick={() => zoom(0.6)} className={chip(false)}>
              +
            </button>
            <button type="button" aria-label="Reset zoom" onClick={resetZoom} className={chip(false)}>
              ⟲
            </button>
          </div>
        ) : null}
      </div>

      <div className="relative">
        <div
          ref={container}
          className={["w-full transition-opacity", loading ? "opacity-60" : ""].join(" ")}
          style={{ height }}
          aria-label="Price chart"
          aria-busy={loading || undefined}
          role="img"
        />
        {/* The bar under the pointer, read as a terminal reads it. A DOM
            overlay rather than a chart primitive, so a candle refresh does not
            wipe the reading (design D6). */}
        {full && reading ? (
          <div
            data-testid="ohlc"
            aria-live="off"
            className="pointer-events-none absolute left-2 top-1 flex flex-wrap items-center gap-x-3 text-xs tabular-nums"
          >
            <Ohlc label="O" value={money(reading.o, precision)} />
            <Ohlc label="H" value={money(reading.h, precision)} />
            <Ohlc label="L" value={money(reading.l, precision)} />
            <Ohlc label="C" value={money(reading.c, precision)} />
            <span className={reading.c >= reading.o ? "text-up" : "text-down"}>
              {reading.c >= reading.o ? "+" : "−"}
              {reading.o > 0 ? Math.abs(((reading.c - reading.o) / reading.o) * 100).toFixed(2) : "0.00"}%
            </span>
          </div>
        ) : null}
      </div>

      {/* The chart's legend: what each coloured line is, and who copied when.
          Both used to be drawn inside the plot, where they collided with the
          axis and clipped at the edges (design D3, D4). */}
      {lines.length > 0 || markers.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {levels.inScale.map((line) => (
            <span key={line.label} className="whitespace-nowrap">
              <span aria-hidden style={{ color: line.color }}>
                ■
              </span>{" "}
              {line.label} ${money(line.price, precision)}
            </span>
          ))}
          {/* Off the scale, but not hidden: the caption still states the price
              and which way it lies, so the idea is never silently trimmed. */}
          {[
            ...levels.above.map((line) => ({ line, where: "above the chart" })),
            ...levels.below.map((line) => ({ line, where: "below the chart" })),
          ].map(({ line, where }) => (
            <span key={line.label} className="whitespace-nowrap text-muted">
              <span aria-hidden style={{ color: line.color }}>
                ▪
              </span>{" "}
              {line.label} ${money(line.price, precision)} · {where}
            </span>
          ))}
          {markers.length > 0 ? (
            <span className="whitespace-nowrap text-muted">
              <span aria-hidden className="text-yellow">
                ▲
              </span>{" "}
              {markers.map((m) => m.label).join(" · ")}
            </span>
          ) : null}
        </div>
      ) : null}

    </div>
  );
}

/** One letter of the crosshair readout: the label quiet, the number legible. */
function Ohlc({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-muted">
      {label} <span className="text-text">{value}</span>
    </span>
  );
}

function toTime(ms: number): UTCTimestamp {
  return Math.floor(ms / 1000) as UTCTimestamp;
}

/** The last bar time at or before `seconds`, or the first bar when earlier than all. */
function snapToBar(times: number[], seconds: number): number {
  let found = times[0] ?? seconds;
  for (const t of times) {
    if (t <= seconds) found = t;
    else break;
  }
  return found;
}
