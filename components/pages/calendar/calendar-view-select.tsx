"use client";

import { CalendarDays, ChartGantt, Table2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

type CalendarView = "calendar" | "timeline" | "table";

type CalendarViewSelectProps = {
  value: CalendarView;
};

function CalendarViewSelect({ value }: CalendarViewSelectProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateView(nextView: string | null) {
    if (
      nextView !== "calendar" &&
      nextView !== "timeline" &&
      nextView !== "table"
    ) {
      return;
    }

    const params = new URLSearchParams(searchParams);
    params.set("view", nextView);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={value} onValueChange={updateView}>
      <SelectTrigger size="sm" className="min-w-36">
        <span className="flex items-center gap-1.5">
          {value === "timeline" ? (
            <>
              <ChartGantt />
              Timeline
            </>
          ) : value === "table" ? (
            <>
              <Table2 />
              Tabela
            </>
          ) : (
            <>
              <CalendarDays />
              Calendario
            </>
          )}
        </span>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="calendar">
          <CalendarDays />
          Calendario
        </SelectItem>
        <SelectItem value="timeline">
          <ChartGantt />
          Timeline
        </SelectItem>
        <SelectItem value="table">
          <Table2 />
          Tabela
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

export { CalendarViewSelect };
export type { CalendarView };
