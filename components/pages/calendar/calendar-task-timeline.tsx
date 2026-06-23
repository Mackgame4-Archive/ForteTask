"use client";

import {
  GanttTimeline,
  type GanttTimelineItem,
  type GanttTimelineRow,
} from "@/components/gantt-timeline";
import { CalendarTaskDialog } from "@/components/pages/calendar/calendar-task-dialog";
import type { CalendarTask } from "@/services/tasks";
import { cn } from "@/lib/utils";

type CalendarTaskTimelineItem = GanttTimelineItem & {
  task: CalendarTask;
};

type CalendarTaskTimelineProps = {
  groupByMember?: boolean;
  tasks: CalendarTask[];
};

function CalendarTaskTimeline({
  groupByMember = false,
  tasks,
}: CalendarTaskTimelineProps) {
  const timelineItems: CalendarTaskTimelineItem[] = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    completed: task.completed,
    startDate: task.startDate,
    dueDate: task.dueDate,
    color: task.column?.color,
    description: [task.board?.name, task.column?.name].filter(Boolean).join(" / "),
    task,
  }));
  const memberRows: GanttTimelineRow<CalendarTaskTimelineItem>[] = groupByMember
    ? getMemberRows(timelineItems)
    : [];

  return (
    <GanttTimeline
      items={timelineItems}
      rows={groupByMember ? memberRows : undefined}
      indexHeaderLabel={groupByMember ? "Membro" : "Tarefa"}
      emptyText="Nenhuma tarefa com datas para mostrar."
      renderRowDescription={
        groupByMember
          ? (row) =>
              `${row.items.length} ${row.items.length === 1 ? "tarefa" : "tarefas"}`
          : undefined
      }
      renderItem={(item) => (
        <CalendarTaskDialog
          task={item.task}
          trigger={<CalendarTimelineTaskTrigger task={item.task} />}
        />
      )}
    />
  );
}

function getMemberRows(items: CalendarTaskTimelineItem[]) {
  const rows = new Map<
    string,
    GanttTimelineRow<CalendarTaskTimelineItem> & { taskIds: Set<number | string> }
  >();

  for (const item of items) {
    const assignees = item.task.assignees.length
      ? item.task.assignees.map(({ user }) => user)
      : [{ id: 0, name: "Sem membro", email: "" }];

    for (const user of assignees) {
      const rowId = String(user.id);
      const existingRow =
        rows.get(rowId) ??
        ({
          id: rowId,
          title: user.name,
          description: "0 tarefas",
          items: [],
          taskIds: new Set<number | string>(),
        } satisfies GanttTimelineRow<CalendarTaskTimelineItem> & {
          taskIds: Set<number | string>;
        });

      existingRow.items.push(item);
      existingRow.taskIds.add(item.id);
      existingRow.description = `${existingRow.taskIds.size} ${
        existingRow.taskIds.size === 1 ? "tarefa" : "tarefas"
      }`;
      rows.set(rowId, existingRow);
    }
  }

  return Array.from(rows.values())
    .sort((first, second) => String(first.title).localeCompare(String(second.title)))
    .map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      items: row.items,
    }));
}

function CalendarTimelineTaskTrigger({ task }: { task: CalendarTask }) {
  return (
    <div
      className={cn(
        "h-7 w-full min-w-7 cursor-pointer border-l-4 bg-muted px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted/70",
        task.completed && "text-muted-foreground line-through"
      )}
      style={{
        borderLeftColor: task.column?.color ?? "var(--primary)",
      }}
      title={[task.title, task.board?.name, task.column?.name]
        .filter(Boolean)
        .join(" - ")}
    >
      <p className="truncate font-medium">{task.title}</p>
    </div>
  );
}

export { CalendarTaskTimeline };
