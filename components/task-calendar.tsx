"use client";

import { type DragEvent, type ReactNode, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
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

export type CalendarItem = {
  id: number | string;
  title: string;
  startDate: Date | string | null;
  dueDate: Date | string | null;
  completed?: boolean;
  color?: string | null;
  description?: ReactNode;
};

type TaskCalendarProps<TItem extends CalendarItem = CalendarItem> = {
  items: TItem[];
  summary?: ReactNode;
  headerActions?: ReactNode;
  canDropOnDay?: (payload: Record<string, unknown>, day: Date) => boolean;
  onDayDrop?: (payload: Record<string, unknown>, day: Date) => void;
  onDayDoubleClick?: (day: Date) => void;
  renderItem?: (item: TItem, context: CalendarItemRenderContext) => ReactNode;
};

type CalendarItemWithRange<TItem extends CalendarItem> = TItem & {
  startsAt: Date;
  endsAt: Date;
};

export type CalendarItemRenderContext = {
  day: Date;
  endsAt: Date;
  position: "single" | "start" | "middle" | "end";
  startsAt: Date;
};

function readCalendarDragPayload(event: DragEvent) {
  const rawValue =
    event.dataTransfer.getData("application/x-drag-payload") ||
    event.dataTransfer.getData("text/plain");

  if (!rawValue) {
    return null;
  }

  try {
    const payload = JSON.parse(rawValue);

    return payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function hasCalendarDragPayload(event: DragEvent) {
  return Array.from(event.dataTransfer.types).some(
    (type) => type === "application/x-drag-payload" || type === "text/plain"
  );
}

function parseItemDate(value: CalendarItem["startDate"]) {
  return parseDateValue(value);
}

function getItemRange<TItem extends CalendarItem>(
  item: TItem
): CalendarItemWithRange<TItem> | null {
  const startDate = parseItemDate(item.startDate);
  const dueDate = parseItemDate(item.dueDate);

  if (!startDate && !dueDate) {
    return null;
  }

  const startsAt = startDate ?? dueDate!;
  const endsAt = dueDate ?? startDate!;

  return startsAt <= endsAt
    ? { ...item, startsAt, endsAt }
    : { ...item, startsAt: endsAt, endsAt: startsAt };
}

function isItemOnDay<TItem extends CalendarItem>(
  item: CalendarItemWithRange<TItem>,
  day: Date
) {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const start = new Date(
    item.startsAt.getFullYear(),
    item.startsAt.getMonth(),
    item.startsAt.getDate()
  );
  const end = new Date(
    item.endsAt.getFullYear(),
    item.endsAt.getMonth(),
    item.endsAt.getDate()
  );

  return dayStart >= start && dayStart <= end;
}

function getItemPositionOnDay<TItem extends CalendarItem>(
  item: CalendarItemWithRange<TItem>,
  day: Date
): CalendarItemRenderContext["position"] {
  const startsOnDay = isSameDay(day, item.startsAt);
  const endsOnDay = isSameDay(day, item.endsAt);

  if (startsOnDay && endsOnDay) {
    return "single";
  }

  if (startsOnDay) {
    return "start";
  }

  if (endsOnDay) {
    return "end";
  }

  return "middle";
}

function TaskCalendar<TItem extends CalendarItem = CalendarItem>({
  items,
  summary,
  headerActions,
  canDropOnDay,
  onDayDrop,
  onDayDoubleClick,
  renderItem,
}: TaskCalendarProps<TItem>) {
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRange = useMemo(() => {
    const today = new Date();

    return {
      endMonth: new Date(today.getFullYear() + 10, 11),
      startMonth: new Date(today.getFullYear() - 10, 0),
    };
  }, []);
  const calendarItems = useMemo(
    () =>
      items
        .map(getItemRange)
        .filter((item): item is CalendarItemWithRange<TItem> => Boolean(item)),
    [items]
  );
  const days = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    const monthEnd = endOfMonth(visibleMonth);

    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 1 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
    });
  }, [visibleMonth]);
  const weekdayLabels = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(new Date(), { weekStartsOn: 1 }),
        end: endOfWeek(new Date(), { weekStartsOn: 1 }),
      }).map((day) => `${formatAppDate(day, "EEE").replace(/\.$/, "")}.`),
    []
  );

  function selectCalendarDay(day: Date | undefined) {
    if (!day) {
      return;
    }

    setSelectedDay(day);
    setVisibleMonth(startOfMonth(day));
    setPickerOpen(false);
  }

  return (
    <Card className="gap-0 overflow-hidden border-x border-t border-foreground/10 py-0 ring-0">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  className="-ml-2 h-auto px-2 py-1 text-lg font-semibold"
                />
              }
            >
              {formatAppDate(visibleMonth, "MMMM yyyy")}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDay}
                month={visibleMonth}
                captionLayout="dropdown"
                startMonth={pickerRange.startMonth}
                endMonth={pickerRange.endMonth}
                onMonthChange={(month) => setVisibleMonth(startOfMonth(month))}
                onSelect={selectCalendarDay}
                locale={appDateLocale}
              />
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground">
            {summary ?? `${items.length} itens agendados`}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-end">
          {headerActions ? (
            <div className="flex flex-wrap items-center gap-2">{headerActions}</div>
          ) : null}
          <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Mês anterior"
            onClick={() => setVisibleMonth((month) => subMonths(month, 1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date();

              setSelectedDay(today);
              setVisibleMonth(startOfMonth(today));
            }}
          >
            Hoje
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Mês seguinte"
            onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
          >
            <ChevronRight />
          </Button>
          </div>
        </div>
      </div>

      <CardContent className="p-0">
        <div className="grid grid-cols-7 border-b border-border bg-muted/50">
          {weekdayLabels.map((weekday) => (
            <div
              key={weekday}
              className="border-r border-border px-2 py-2 text-center text-xs font-medium text-muted-foreground nth-[7n]:border-r-0"
            >
              {weekday}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayItems = calendarItems.filter((item) =>
              isItemOnDay(item, day)
            );
            const visibleItems = dayItems.slice(0, 3);
            const hiddenItemCount = dayItems.length - visibleItems.length;
            const dayIsSelected = isSameDay(day, selectedDay);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-28 border-b border-r border-border bg-background p-2 nth-[7n]:border-r-0",
                  !isSameMonth(day, visibleMonth) && "bg-muted/30 text-muted-foreground"
                )}
                onDragOver={
                  onDayDrop
                    ? (event) => {
                        if (!hasCalendarDragPayload(event)) {
                          event.dataTransfer.dropEffect = "none";
                          return;
                        }

                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }
                    : undefined
                }
                onDrop={
                  onDayDrop
                    ? (event) => {
                        const payload = readCalendarDragPayload(event);

                        if (!payload || canDropOnDay?.(payload, day) === false) {
                          return;
                        }

                        event.preventDefault();
                        onDayDrop(payload, day);
                      }
                    : undefined
                }
                onDoubleClick={() => onDayDoubleClick?.(day)}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center text-xs font-medium",
                      isToday(day) && "bg-primary text-primary-foreground",
                      dayIsSelected && "bg-secondary text-secondary-foreground"
                    )}
                  >
                    {formatAppDate(day, "d")}
                  </span>
                </div>
                <div className="space-y-1">
                  {visibleItems.map((item) => (
                    <div
                      key={`${day.toISOString()}-${item.id}`}
                      onDoubleClick={(event) => event.stopPropagation()}
                    >
                      {renderItem ? (
                        renderItem(item, {
                          day,
                          endsAt: item.endsAt,
                          position: getItemPositionOnDay(item, day),
                          startsAt: item.startsAt,
                        })
                      ) : (
                        <CalendarDefaultItem item={item} />
                      )}
                    </div>
                  ))}
                  {hiddenItemCount > 0 ? (
                    <div className="px-2 text-[11px] text-muted-foreground">
                      +{hiddenItemCount} mais
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function CalendarDefaultItem({ item }: { item: CalendarItem }) {
  return (
    <div
      className={cn(
        "min-w-0 border-l-2 bg-muted px-2 py-1 text-xs text-foreground",
        item.completed && "text-muted-foreground line-through"
      )}
      style={{
        borderLeftColor: item.color ?? "var(--primary)",
      }}
      title={item.title}
    >
      <p className="truncate font-medium">{item.title}</p>
      {item.description ? (
        <p className="truncate text-[11px] text-muted-foreground">
          {item.description}
        </p>
      ) : null}
    </div>
  );
}

export { TaskCalendar };
