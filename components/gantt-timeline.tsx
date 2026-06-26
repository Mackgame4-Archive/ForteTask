"use client";

import { type ReactNode, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { appDateLocale, formatAppDate, parseDateValue } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

export type GanttTimelineItem = {
  id: number | string;
  title: string;
  startDate: Date | string | null;
  dueDate: Date | string | null;
  color?: string | null;
  completed?: boolean;
  description?: ReactNode;
};

export type GanttTimelineRow<TItem extends GanttTimelineItem = GanttTimelineItem> = {
  id: number | string;
  title: ReactNode;
  description?: ReactNode;
  items: TItem[];
};

type GanttTimelineProps<TItem extends GanttTimelineItem = GanttTimelineItem> = {
  items: TItem[];
  rows?: GanttTimelineRow<TItem>[];
  indexHeaderLabel?: ReactNode;
  emptyText?: string;
  renderItem?: (item: TItem) => ReactNode;
  renderRowDescription?: (row: GanttTimelineRowWithRanges<TItem>) => ReactNode;
};

type GanttTimelineItemWithRange<TItem extends GanttTimelineItem> = TItem & {
  startsAt: Date;
  endsAt: Date;
};

type GanttTimelineRowWithRanges<TItem extends GanttTimelineItem> = Omit<
  GanttTimelineRow<TItem>,
  "items"
> & {
  items: GanttTimelineItemWithRange<TItem>[];
};

const dayColumnWidth = "2.75rem";
const timelineLaneHeight = "3rem";
const titleColumnWidth = "16rem";
const borderColor = "var(--border)";
const dayDividerBackground = `linear-gradient(to right, transparent calc(${dayColumnWidth} - 1px), ${borderColor} calc(${dayColumnWidth} - 1px), ${borderColor} ${dayColumnWidth})`;
const todayHighlight = "color-mix(in oklab, var(--primary) 5%, transparent)";

function getItemRange<TItem extends GanttTimelineItem>(
  item: TItem
): GanttTimelineItemWithRange<TItem> | null {
  const startDate = parseDateValue(item.startDate);
  const dueDate = parseDateValue(item.dueDate);

  if (!startDate && !dueDate) {
    return null;
  }

  const startsAt = startDate ?? dueDate!;
  const endsAt = dueDate ?? startDate!;

  return startsAt <= endsAt
    ? { ...item, startsAt, endsAt }
    : { ...item, startsAt: endsAt, endsAt: startsAt };
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function getDayOffset(start: Date, day: Date) {
  return Math.round(
    (startOfDay(day).getTime() - startOfDay(start).getTime()) / 86_400_000
  );
}

function maxDate(first: Date, second: Date) {
  return first > second ? first : second;
}

function minDate(first: Date, second: Date) {
  return first < second ? first : second;
}

function getTimelineMonthStart(day: Date) {
  return startOfWeek(startOfMonth(day), { weekStartsOn: 1 });
}

function getTimelineMonthEnd(day: Date) {
  return endOfWeek(endOfMonth(day), { weekStartsOn: 1 });
}

function GanttTimeline<TItem extends GanttTimelineItem = GanttTimelineItem>({
  items,
  rows,
  indexHeaderLabel = "Tarefa",
  emptyText = "Sem itens agendados.",
  renderItem,
  renderRowDescription,
}: GanttTimelineProps<TItem>) {
  const timelineRows = useMemo<GanttTimelineRowWithRanges<TItem>[]>(() => {
    if (rows) {
      return rows
        .map((row) => ({
          ...row,
          items: row.items
            .map(getItemRange)
            .filter((item): item is GanttTimelineItemWithRange<TItem> =>
              Boolean(item)
            )
            .sort(
              (first, second) =>
                first.startsAt.getTime() - second.startsAt.getTime()
            ),
        }))
        .filter((row) => row.items.length);
    }

    return items
      .map(getItemRange)
      .filter((item): item is GanttTimelineItemWithRange<TItem> =>
        Boolean(item)
      )
      .sort(
        (first, second) => first.startsAt.getTime() - second.startsAt.getTime()
      )
      .map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        items: [item],
      }));
  }, [items, rows]);
  const timelineItems = useMemo(
    () => timelineRows.flatMap((row) => row.items),
    [timelineRows]
  );
  const [startMonth, setStartMonth] = useState(() =>
    startOfMonth(timelineItems[0]?.startsAt ?? new Date())
  );
  const [endMonth, setEndMonth] = useState(() =>
    startOfMonth(timelineItems[0]?.startsAt ?? new Date())
  );
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);
  const pickerRange = useMemo(() => {
    const today = new Date();

    return {
      endMonth: new Date(today.getFullYear() + 10, 11),
      startMonth: new Date(today.getFullYear() - 10, 0),
    };
  }, []);
  const timelineRange = useMemo(
    () => ({
      start: getTimelineMonthStart(startMonth),
      end: getTimelineMonthEnd(endMonth),
    }),
    [endMonth, startMonth]
  );
  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: timelineRange.start,
        end: timelineRange.end,
      }),
    [timelineRange]
  );
  const visibleItems = useMemo(
    () =>
      timelineItems.filter(
        (item) => item.endsAt >= timelineRange.start && item.startsAt <= timelineRange.end
      ),
    [timelineItems, timelineRange]
  );
  const visibleRows = useMemo(
    () =>
      timelineRows
        .map((row) => ({
          ...row,
          items: row.items.filter(
            (item) =>
              item.endsAt >= timelineRange.start &&
              item.startsAt <= timelineRange.end
          ),
        }))
        .filter((row) => row.items.length),
    [timelineRange, timelineRows]
  );
  const timelineStartTitle = formatAppDate(startMonth, "MMMM yyyy");
  const timelineEndTitle = formatAppDate(endMonth, "MMMM yyyy");
  const dayGridTemplateColumns = `repeat(${days.length}, minmax(${dayColumnWidth}, ${dayColumnWidth}))`;

  function selectStartMonth(day: Date | undefined) {
    if (!day) {
      return;
    }

    const nextStart = startOfMonth(day);
    const nextEnd = nextStart > endMonth ? nextStart : endMonth;

    setStartMonth(nextStart);
    setEndMonth(nextEnd);
    setStartPickerOpen(false);
  }

  function selectEndMonth(day: Date | undefined) {
    if (!day) {
      return;
    }

    const nextEnd = startOfMonth(day);
    const nextStart = nextEnd < startMonth ? nextEnd : startMonth;

    setStartMonth(nextStart);
    setEndMonth(nextEnd);
    setEndPickerOpen(false);
  }

  function showStartMonth(day: Date) {
    selectStartMonth(day);
    setStartPickerOpen(true);
  }

  function showEndMonth(day: Date) {
    selectEndMonth(day);
    setEndPickerOpen(true);
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-1">
            <Popover open={startPickerOpen} onOpenChange={setStartPickerOpen}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    className="-ml-2 h-auto px-2 py-1 text-lg font-semibold"
                  />
                }
              >
                {timelineStartTitle}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startMonth}
                  month={startMonth}
                  captionLayout="dropdown"
                  startMonth={pickerRange.startMonth}
                  endMonth={pickerRange.endMonth}
                  onMonthChange={showStartMonth}
                  onSelect={selectStartMonth}
                  locale={appDateLocale}
                />
              </PopoverContent>
            </Popover>
            <span className="text-lg font-semibold text-muted-foreground">-</span>
            <Popover open={endPickerOpen} onOpenChange={setEndPickerOpen}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto px-2 py-1 text-lg font-semibold"
                  />
                }
              >
                {timelineEndTitle}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endMonth}
                  month={endMonth}
                  captionLayout="dropdown"
                  startMonth={pickerRange.startMonth}
                  endMonth={pickerRange.endMonth}
                  onMonthChange={showEndMonth}
                  onSelect={selectEndMonth}
                  locale={appDateLocale}
                />
              </PopoverContent>
            </Popover>
          </div>
          <p className="text-xs text-muted-foreground">
            {visibleItems.length} de {timelineItems.length} tarefas com datas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Intervalo anterior"
            onClick={() => {
              setStartMonth((month) => subMonths(month, 1));
              setEndMonth((month) => subMonths(month, 1));
            }}
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const currentMonth = startOfMonth(new Date());

              setStartMonth(currentMonth);
              setEndMonth(currentMonth);
            }}
          >
            Hoje
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Intervalo seguinte"
            onClick={() => {
              setStartMonth((month) => addMonths(month, 1));
              setEndMonth((month) => addMonths(month, 1));
            }}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
      <CardContent className="p-0">
        <div className="overflow-x-auto md:overflow-visible">
          <div className="flex min-w-max md:min-w-0">
          <div
            className="shrink-0 border-r border-border"
            style={{
              flexBasis: titleColumnWidth,
              width: titleColumnWidth,
            }}
          >
            <div className="flex h-12 items-center border-b border-border bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
              {indexHeaderLabel}
            </div>
            {visibleRows.length ? (
              visibleRows.map((row) => {
                const rowDescription = renderRowDescription?.(row) ?? row.description;

                return (
                  <div
                    key={row.id}
                    className="flex min-h-12 min-w-0 items-center border-b border-border bg-card px-3 py-2 last:border-b-0"
                    style={{
                      height: `calc(${row.items.length} * ${timelineLaneHeight})`,
                    }}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{row.title}</p>
                      {rowDescription ? (
                        <p className="truncate text-[11px] text-muted-foreground">
                          {rowDescription}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="min-h-32 border-b border-border" />
            )}
          </div>

          <div className="min-w-0 flex-1 md:overflow-x-auto">
            <div className="min-w-max">
              <div
                className="grid h-12 border-b border-border bg-muted/50"
                style={{
                  backgroundImage: dayDividerBackground,
                  backgroundSize: `${dayColumnWidth} 100%`,
                  gridTemplateColumns: dayGridTemplateColumns,
                }}
              >
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "flex h-12 min-h-0 flex-col items-center justify-center px-2 text-center text-[11px] leading-tight text-muted-foreground",
                    isToday(day) && "bg-primary/10 text-foreground"
                  )}
                >
                  <div className="font-medium">{formatAppDate(day, "d")}</div>
                  <div>{formatAppDate(day, "EEE")}</div>
                </div>
              ))}
              </div>

              {visibleRows.length ? (
                visibleRows.map((row) => {
                  const rowTemplateRows = `repeat(${row.items.length}, minmax(${timelineLaneHeight}, ${timelineLaneHeight}))`;
                  const rowHeight = `calc(${row.items.length} * ${timelineLaneHeight})`;

                  return (
                    <div
                      key={row.id}
                      className="grid min-h-12 border-b border-border last:border-b-0"
                      style={{
                        gridTemplateColumns: dayGridTemplateColumns,
                        gridTemplateRows: rowTemplateRows,
                        height: rowHeight,
                      }}
                    >
                      <div
                        aria-hidden="true"
                        className="pointer-events-none"
                        style={{
                          gridColumn: `1 / span ${days.length}`,
                          gridRow: `1 / span ${row.items.length}`,
                          backgroundImage: dayDividerBackground,
                          backgroundSize: `${dayColumnWidth} 100%`,
                        }}
                      />
                      {days.map((day, dayIndex) =>
                        isToday(day) ? (
                          <div
                            aria-hidden="true"
                            key={`timeline-today-${day.toISOString()}`}
                            className="pointer-events-none"
                            style={{
                              backgroundColor: todayHighlight,
                              gridColumn: dayIndex + 1,
                              gridRow: `1 / span ${row.items.length}`,
                            }}
                          />
                        ) : null
                      )}
                      {row.items.map((item, itemIndex) => {
                        const startsAt = maxDate(item.startsAt, timelineRange.start);
                        const endsAt = minDate(item.endsAt, timelineRange.end);
                        const startOffset = getDayOffset(timelineRange.start, startsAt);
                        const endOffset = getDayOffset(timelineRange.start, endsAt);
                        const span = Math.max(endOffset - startOffset + 1, 1);

                        return (
                          <div
                            key={`${row.id}-${item.id}-${itemIndex}`}
                            className="z-10 flex min-w-0 items-center px-1 py-2 *:w-full"
                            style={{
                              gridColumn: `${startOffset + 1} / span ${span}`,
                              gridRow: itemIndex + 1,
                            }}
                          >
                            {renderItem ? (
                              renderItem(item)
                            ) : (
                              <GanttTimelineBar item={item} />
                            )}
                          </div>
                        );
                      })}
                      <div
                        aria-hidden="true"
                        className="pointer-events-none z-20"
                        style={{
                          backgroundImage: dayDividerBackground,
                          backgroundSize: `${dayColumnWidth} 100%`,
                          gridColumn: `1 / span ${days.length}`,
                          gridRow: `1 / span ${row.items.length}`,
                        }}
                      />
                    </div>
                  );
                })
              ) : (
                <div
                  className="grid min-h-32 place-items-center border-b border-border text-sm text-muted-foreground"
                  style={{ gridTemplateColumns: dayGridTemplateColumns }}
                >
                  <div
                    className="px-4 py-8 text-center"
                    style={{ gridColumn: `1 / span ${days.length}` }}
                  >
                    {timelineItems.length ? "Sem tarefas neste intervalo." : emptyText}
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GanttTimelineBar({ item }: { item: GanttTimelineItem }) {
  return (
    <div
      className={cn(
        "h-7 w-full min-w-7 border-l-4 bg-muted px-2 py-1 text-xs text-foreground",
        item.completed && "text-muted-foreground line-through"
      )}
      style={{ borderLeftColor: item.color ?? "var(--primary)" }}
      title={item.title}
    >
      <p className="truncate font-medium">{item.title}</p>
    </div>
  );
}

export { GanttTimeline };
