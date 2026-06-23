"use client"

import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  XAxis,
  YAxis,
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

type BarChartProps = BaseChartProps & {
  layout?: "horizontal" | "vertical"
  series: ChartSeries[]
  showLegend?: boolean
  xAxisKey: string
}

export function BarChart({
  className,
  config,
  data,
  layout = "horizontal",
  series,
  showLegend = true,
  xAxisKey,
}: BarChartProps) {
  const isVertical = layout === "vertical"

  return (
    <ChartContainer
      config={config}
      className={cn("h-[240px] w-full", className)}
    >
      <RechartsBarChart
        accessibilityLayer
        data={data}
        layout={isVertical ? "vertical" : undefined}
      >
        <CartesianGrid vertical={false} />
        {isVertical ? (
          <>
            <XAxis type="number" hide />
            <YAxis
              dataKey={xAxisKey}
              type="category"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={90}
            />
          </>
        ) : (
          <XAxis
            dataKey={xAxisKey}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
        )}
        <ChartTooltip content={<ChartTooltipContent />} />
        {showLegend ? <ChartLegend content={<ChartLegendContent />} /> : null}
        {series.map((item) => (
          <Bar
            key={item.dataKey}
            dataKey={item.dataKey}
            name={item.name}
            fill={`var(--color-${item.dataKey})`}
            radius={4}
          />
        ))}
      </RechartsBarChart>
    </ChartContainer>
  )
}
