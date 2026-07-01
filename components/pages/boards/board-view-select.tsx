"use client";

import { useEffect } from "react";
import { CalendarDays, ChartGantt, Columns3, Table2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

type BoardView = "board" | "calendar" | "timeline" | "table";

const boardViewStorageKey = "intranet:boards:view";
const boardViews = ["board", "calendar", "timeline", "table"] as const;

type BoardViewSelectProps = {
  value: BoardView;
};

function isBoardView(value: string | null): value is BoardView {
  return boardViews.some((view) => view === value);
}

function BoardViewSelect({ value }: BoardViewSelectProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    try {
      if (searchParams.has("view")) {
        window.localStorage.setItem(boardViewStorageKey, value);
        return;
      }

      const savedView = window.localStorage.getItem(boardViewStorageKey);

      if (!isBoardView(savedView) || savedView === value) {
        return;
      }

      const params = new URLSearchParams(searchParams);
      params.set("view", savedView);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    } catch {
      // Ignore storage access errors and keep the URL-selected view.
    }
  }, [pathname, router, searchParams, value]);

  function updateView(nextView: string | null) {
    if (!isBoardView(nextView)) {
      return;
    }

    try {
      window.localStorage.setItem(boardViewStorageKey, nextView);
    } catch {
      // The URL remains the source of truth when storage is unavailable.
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
