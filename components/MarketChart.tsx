"use client";

import dynamic from "next/dynamic";

import type { MarketChartProps } from "@/components/MarketChartInner";

/** Loads the canvas chart only in the browser; shows a skeleton meanwhile. */
export const MarketChart = dynamic<MarketChartProps>(() => import("@/components/MarketChartInner"), {
  ssr: false,
  loading: () => <div className="h-[260px] w-full animate-pulse rounded-card bg-surface motion-reduce:animate-none" aria-hidden />,
});

export type { ChartLine, ChartMarker, ChartType, MarketChartProps } from "@/components/MarketChartInner";
