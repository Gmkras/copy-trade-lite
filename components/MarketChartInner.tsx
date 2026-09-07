"use client";

import { useEffect, useRef, useState } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
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

/** Two labels closer than this (px) would overlap: the non-entry one gives way. */
const LABEL_GAP = 12;

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
      rightPriceScale: { borderColor: COLORS.line, scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: { borderColor: COLORS.line, timeVisible: true, secondsVisible: false },
      crosshair: { horzLine: { color: COLORS.muted }, vertLine: { color: COLORS.muted } },
      handleScroll: { vertTouchDrag: false },
      handleScale: { pinch: true, mouseWheel: true, axisPressedMouseMove: true },
    });
    chartRef.current = chart;

    // Keep every level inside the visible price range, even far TP/SL levels.
    const linePrices = lines.map((l) => l.price);
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

    // Levels: lines always; labels only where they do not sit on each other.
    // (The title is part of the axis label in lightweight-charts, so hiding the
    // label would hide the name too; the collision rule is what keeps it clean.)
    const withCoords = lines.map((line) => ({ line, y: series.priceToCoordinate(line.price) }));
    const hidden = new Set<string>();
    // The series' own last-price label always wins: a level sitting on it loses its label.
    const lastY = series.priceToCoordinate(last.c);
    for (const a of withCoords) {
      if (a.y !== null && lastY !== null && Math.abs(a.y - lastY) < LABEL_GAP) hidden.add(a.line.label);
      for (const b of withCoords) {
        if (a === b || a.y === null || b.y === null || Math.abs(a.y - b.y) >= LABEL_GAP) continue;
        // Entry wins; otherwise the later one in the list gives way.
        const loser = a.line.label === "Entry" ? b : b.line.label === "Entry" ? a : withCoords.indexOf(a) < withCoords.indexOf(b) ? b : a;
        hidden.add(loser.line.label);
      }
    }
    for (const line of lines) {
      const crowded = hidden.has(line.label);
      series.createPriceLine({
        price: line.price,
        color: line.color,
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: !crowded,
        title: crowded ? "" : line.label,
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
          text: m.label,
        }))
        .sort((a, b) => (a.time as number) - (b.time as number));
      createSeriesMarkers(series, seriesMarkers);
    }

    chart.timeScale().fitContent();
    // How many bars are on screen, readable by tests and assistive tooling.
    chart.timeScale().subscribeVisibleLogicalRangeChange((visible) => {
      if (visible) el.dataset.visibleBars = String(Math.round(visible.to - visible.from));
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
  }, [candles, lines, markers, height, precision, variant, type]);

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
      <div
        ref={container}
        className={["w-full transition-opacity", loading ? "opacity-60" : ""].join(" ")}
        style={{ height }}
        aria-label="Price chart"
        aria-busy={loading || undefined}
        role="img"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <div role="group" aria-label="Chart type" className="flex gap-1">
          {TYPES.map((t) => (
            <button key={t.id} type="button" aria-pressed={type === t.id} onClick={() => chooseType(t.id)} className={chip(type === t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Range" className="flex gap-1">
          {RANGES.map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => onRangeChange(r)} className={chip(range === r)}>
              {r}
            </button>
          ))}
        </div>
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
      </div>
    </div>
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
