"use client"

import { Pie, PieChart as RechartsPieChart } from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"

import type { BaseChartProps } from "./types"

type PieChartProps = BaseChartProps & {
  dataKey: string
  nameKey: string
  showLegend?: boolean
}

export function PieChart({
  className,
  config,
  data,
  dataKey,
  nameKey,
  showLegend = true,
}: PieChartProps) {
  return (
    <ChartContainer
      config={config}
      className={cn("h-[240px] w-full", className)}
    >
      <RechartsPieChart accessibilityLayer>
        <ChartTooltip
          content={<ChartTooltipContent hideLabel nameKey={nameKey} />}
        />
        <Pie
          data={data}
          dataKey={dataKey}
          nameKey={nameKey}
          innerRadius={48}
          outerRadius={78}
          strokeWidth={2}
        />
        {showLegend ? (
          <ChartLegend
            content={<ChartLegendContent nameKey={nameKey} />}
            className="flex-wrap"
          />
        ) : null}
      </RechartsPieChart>
    </ChartContainer>
  )
}
