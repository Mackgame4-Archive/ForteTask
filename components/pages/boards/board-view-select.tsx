"use client";

import { CalendarDays, ChartGantt, Columns3, Table2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

type BoardView = "board" | "calendar" | "timeline" | "table";

type BoardViewSelectProps = {
  value: BoardView;
};

function BoardViewSelect({ value }: BoardViewSelectProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateView(nextView: string | null) {
    if (
      nextView !== "board" &&
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
          {value === "calendar" ? (
            <>
              <CalendarDays />
              Calendário
            </>
          ) : value === "timeline" ? (
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
              <Columns3 />
              Quadro
            </>
          )}
        </span>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="board">
          <Columns3 />
          Quadro
        </SelectItem>
        <SelectItem value="calendar">
          <CalendarDays />
          Calendário
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

export { BoardViewSelect };
export type { BoardView };
