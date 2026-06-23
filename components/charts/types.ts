"use client"

import type { ChartConfig } from "@/components/ui/chart"

export type ChartData = Record<string, number | string | undefined>

export type ChartSeries = {
  dataKey: string
  name?: string
}

export type BaseChartProps = {
  className?: string
  config: ChartConfig
  data: ChartData[]
}
