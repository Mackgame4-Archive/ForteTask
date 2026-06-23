"use client"

import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
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

type LineChartProps = BaseChartProps & {
  series: ChartSeries[]
  showLegend?: boolean
  xAxisKey: string
}

export function LineChart({
  className,
  config,
  data,
  series,
  showLegend = true,
  xAxisKey,
}: LineChartProps) {
  return (
    <ChartContainer
      config={config}
      className={cn("h-[240px] w-full", className)}
    >
      <RechartsLineChart accessibilityLayer data={data}>
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
          <Line
            key={item.dataKey}
            dataKey={item.dataKey}
            name={item.name}
            type="monotone"
            stroke={`var(--color-${item.dataKey})`}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </RechartsLineChart>
    </ChartContainer>
  )
}
