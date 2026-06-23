"use client"

import { PolarRadiusAxis, RadialBar, RadialBarChart } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"

import type { BaseChartProps } from "./types"

type RadialChartProps = BaseChartProps & {
  dataKey: string
  nameKey: string
}

export function RadialChart({
  className,
  config,
  data,
  dataKey,
  nameKey,
}: RadialChartProps) {
  return (
    <ChartContainer
      config={config}
      className={cn("h-[240px] w-full", className)}
    >
      <RadialBarChart
        accessibilityLayer
        data={data}
        innerRadius={48}
        outerRadius={92}
      >
        <ChartTooltip
          content={<ChartTooltipContent hideLabel nameKey={nameKey} />}
        />
        <PolarRadiusAxis tick={false} tickLine={false} axisLine={false} />
        <RadialBar
          dataKey={dataKey}
          background
          cornerRadius={6}
        />
      </RadialBarChart>
    </ChartContainer>
  )
}
