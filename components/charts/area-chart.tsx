"use client"

import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  XAxis,
} from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"

import type { BaseChartProps, ChartSeries } from "./types"

type AreaChartProps = BaseChartProps & {
  series: ChartSeries[]
  showLegend?: boolean
  stacked?: boolean
  xAxisKey: string
}

export function AreaChart({
  className,
  config,
  data,
  series,
  showLegend = true,
  stacked = false,
  xAxisKey,
}: AreaChartProps) {
  return (
    <ChartContainer
      config={config}
      className={cn("h-[240px] w-full", className)}
    >
      <RechartsAreaChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey={xAxisKey}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        {showLegend ? <ChartLegend content={<ChartLegendContent />} /> : null}
        {series.map((item) => (
          <Area
            key={item.dataKey}
            dataKey={item.dataKey}
            name={item.name}
            type="natural"
            fill={`var(--color-${item.dataKey})`}
            fillOpacity={0.28}
            stroke={`var(--color-${item.dataKey})`}
            stackId={stacked ? "stack" : undefined}
          />
        ))}
      </RechartsAreaChart>
    </ChartContainer>
  )
}
