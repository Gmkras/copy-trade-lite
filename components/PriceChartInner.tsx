"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

import type { Candle } from "@/lib/schemas";

export type ChartLine = { price: number; label: string; color: string };
export type ChartMarker = { time: number; label: string };

export type PriceChartProps = {
  candles: Candle[];
  lines: ChartLine[];
  markers: ChartMarker[];
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

/**
 * Candlestick chart (TradingView lightweight-charts v5) with horizontal price
 * lines and markers. Client-only: uses <canvas>. Loaded through PriceChart.tsx
 * with `ssr: false`.
 */
export default function PriceChartInner({ candles, lines, markers, height = 260, precision = 2 }: PriceChartProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = container.current;
    if (!el || candles.length === 0) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: COLORS.bg },
        textColor: COLORS.muted,
        fontFamily: "Inter, system-ui, sans-serif",
        attributionLogo: false,
      },
      grid: { vertLines: { color: COLORS.line }, horzLines: { color: COLORS.line } },
      rightPriceScale: { borderColor: COLORS.line },
      timeScale: { borderColor: COLORS.line, timeVisible: true, secondsVisible: false },
      crosshair: { horzLine: { color: COLORS.muted }, vertLine: { color: COLORS.muted } },
      handleScroll: { vertTouchDrag: false },
    });
    chartRef.current = chart;

    // Keep every line inside the visible price range, even far TP/SL levels.
    const linePrices = lines.map((l) => l.price);
    const series = chart.addSeries(CandlestickSeries, {
      upColor: COLORS.up,
      downColor: COLORS.down,
      wickUpColor: COLORS.up,
      wickDownColor: COLORS.down,
      borderVisible: false,
      priceFormat: { type: "price", precision, minMove: 1 / 10 ** precision },
      autoscaleInfoProvider: (original: () => { priceRange: { minValue: number; maxValue: number } } | null) => {
        const base = original();
        if (!base || linePrices.length === 0) return base;
        return {
          ...base,
          priceRange: {
            minValue: Math.min(base.priceRange.minValue, ...linePrices),
            maxValue: Math.max(base.priceRange.maxValue, ...linePrices),
          },
        };
      },
    });

    const data = candles.map((c) => ({
      time: Math.floor(c.t / 1000) as UTCTimestamp,
      open: c.o,
      high: c.h,
      low: c.l,
      close: c.c,
    }));
    series.setData(data);

    for (const line of lines) {
      series.createPriceLine({
        price: line.price,
        color: line.color,
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: line.label,
      });
    }

    if (markers.length > 0) {
      const first = data[0]?.time ?? 0;
      const last = data[data.length - 1]?.time ?? 0;
      const seriesMarkers: SeriesMarker<Time>[] = markers
        .map((m) => {
          // Markers must sit on a bar: snap to the candle that contains the copy time.
          const seconds = Math.floor(m.time / 1000);
          const snapped = Math.min(Math.max(Math.floor(seconds / 60) * 60, first), last) as UTCTimestamp;
          return { time: snapped, position: "belowBar" as const, color: COLORS.yellow, shape: "arrowUp" as const, text: m.label };
        })
        .sort((a, b) => (a.time as number) - (b.time as number));
      createSeriesMarkers(series, seriesMarkers);
    }

    chart.timeScale().fitContent();

    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth });
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, lines, markers, height, precision]);

  return <div ref={container} className="w-full" style={{ height }} aria-label="Price chart" role="img" />;
}
