"use client";

import dynamic from "next/dynamic";

import type { PriceChartProps } from "@/components/PriceChartInner";

/** Loads the canvas chart only in the browser; shows a skeleton meanwhile. */
export const PriceChart = dynamic<PriceChartProps>(() => import("@/components/PriceChartInner"), {
  ssr: false,
  loading: () => <div className="h-[260px] w-full animate-pulse rounded-card bg-surface motion-reduce:animate-none" aria-hidden />,
});

export type { ChartLine, ChartMarker, PriceChartProps } from "@/components/PriceChartInner";
