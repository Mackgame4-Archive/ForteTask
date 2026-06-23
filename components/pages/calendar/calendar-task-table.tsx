"use client";

import type { ColumnDef, VisibilityState } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { CalendarTaskDialog } from "@/components/pages/calendar/calendar-task-dialog";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateInputValue, parseDateValue } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import type { CalendarTask } from "@/services/tasks";

type CalendarTaskTableProps = {
  tasks: CalendarTask[];
};

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function getDateTime(value: string | null) {
  return parseDateValue(value)?.getTime() ?? 0;
}

function getDateText(value: string | null) {
  return formatDateInputValue(parseDateValue(value)) || "-";
}

function getChecklistSummary(task: CalendarTask) {
  if (!task.subTasks.length) {
    return "-";
  }

  const completedSubTasks = task.subTasks.filter(
    (subTask) => subTask.completedAt
  ).length;

  return `${completedSubTasks}/${task.subTasks.length}`;
}

function CalendarTaskTable({ tasks }: CalendarTaskTableProps) {
  const columns: ColumnDef<CalendarTask>[] = [
    {
      id: "name",
      header: "Nome",
      accessorFn: (task) => task.title,
      meta: {
        cellClassName: "p-0",
      },
      cell: ({ row }) => {
        const task = row.original;

        return (
          <CalendarTaskDialog
            task={task}
            trigger={
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "h-auto min-h-10 w-full justify-start px-2 py-1 text-left font-medium",
                  task.completed && "text-muted-foreground line-through"
                )}
              >
                <span
                  className="size-2 shrink-0"
                  style={{ backgroundColor: task.column?.color ?? "var(--primary)" }}
                />
                <span className="truncate">{task.title}</span>
              </Button>
            }
          />
        );
      },
    },
    {
      id: "board",
      header: "Quadro",
      accessorFn: (task) => task.board?.name ?? "",
      cell: ({ row }) =>
        row.original.board ? (
          <Badge variant="outline">{row.original.board.name}</Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      id: "column",
      header: "Coluna",
      accessorFn: (task) => task.column?.name ?? "",
      cell: ({ row }) =>
        row.original.column ? (
          <Badge
            variant="secondary"
            style={{ borderLeft: `3px solid ${row.original.column.color}` }}
          >
            {row.original.column.name}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      id: "description",
      header: "Descricao",
      accessorFn: (task) => task.description ?? "",
      cell: ({ row }) => (
        <span className="block max-w-80 truncate text-muted-foreground">
          {row.original.description || "-"}
        </span>
      ),
    },
    {
      id: "members",
      header: "Membros",
      accessorFn: (task) =>
        task.assignees.map(({ user }) => user.name).join(" "),
      cell: ({ row }) => {
        const visibleAssignees = row.original.assignees.slice(0, 3);
        const remainingAssignees = Math.max(
          row.original.assignees.length - visibleAssignees.length,
          0
        );

        return visibleAssignees.length ? (
          <AvatarGroup>
            {visibleAssignees.map(({ user }) => (
              <Avatar key={user.id} size="sm" title={user.name}>
                <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
              </Avatar>
            ))}
            {remainingAssignees ? (
              <AvatarGroupCount>+{remainingAssignees}</AvatarGroupCount>
            ) : null}
          </AvatarGroup>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      id: "startDate",
      header: "Data inicio",
      accessorFn: (task) => getDateTime(task.startDate),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {getDateText(row.original.startDate)}
        </span>
      ),
    },
    {
      id: "dueDate",
      header: "Data limite",
      accessorFn: (task) => getDateTime(task.dueDate),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {getDateText(row.original.dueDate)}
        </span>
      ),
    },
    {
      id: "completed",
      header: "Concluida",
      accessorFn: (task) => (task.completed ? 1 : 0),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.completed ? "Sim" : "Nao"}
        </span>
      ),
    },
    {
      id: "completedAt",
      header: "Data conclusao",
      accessorFn: (task) => getDateTime(task.completedAt),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {getDateText(row.original.completedAt)}
        </span>
      ),
    },
    {
      id: "labels",
      header: "Etiquetas",
      accessorFn: (task) =>
        task.labels.map(({ label }) => label.name).join(" "),
      cell: ({ row }) =>
        row.original.labels.length ? (
          <div className="flex flex-wrap gap-1">
            {row.original.labels.map(({ label }) => (
              <Badge key={label.id} variant="secondary">
                {label.name}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      id: "checklist",
      header: "Checklist",
      accessorFn: (task) => {
        if (!task.subTasks.length) {
          return 0;
        }

        return (
          task.subTasks.filter((subTask) => subTask.completedAt).length /
          task.subTasks.length
        );
      },
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {getChecklistSummary(row.original)}
        </span>
      ),
    },
  ];
  const initialColumnVisibility: VisibilityState = {
    completed: false,
    completedAt: false,
    description: false,
    checklist: false,
  };

  return (
    <DataTable
      columns={columns}
      data={tasks}
      initialColumnVisibility={initialColumnVisibility}
    />
  );
}

export { CalendarTaskTable };
