"use client"

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart as RechartsRadarChart,
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

type RadarChartProps = BaseChartProps & {
  angleAxisKey: string
  series: ChartSeries[]
  showLegend?: boolean
}

export function RadarChart({
  angleAxisKey,
  className,
  config,
  data,
  series,
  showLegend = true,
}: RadarChartProps) {
  return (
    <ChartContainer
      config={config}
      className={cn("h-[240px] w-full", className)}
    >
      <RechartsRadarChart accessibilityLayer data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey={angleAxisKey} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {showLegend ? <ChartLegend content={<ChartLegendContent />} /> : null}
        {series.map((item) => (
          <Radar
            key={item.dataKey}
            dataKey={item.dataKey}
            name={item.name}
            fill={`var(--color-${item.dataKey})`}
            fillOpacity={0.28}
            stroke={`var(--color-${item.dataKey})`}
          />
        ))}
      </RechartsRadarChart>
    </ChartContainer>
  )
}
