"use client";

import type { ColumnDef, VisibilityState } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import {
  TaskDialog,
  type TaskDialogTask,
} from "@/components/pages/boards/task-dialog";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateInputValue } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

type BoardTableColumn = {
  id: number;
  name: string;
  color: string;
  tasks: TaskDialogTask[];
};

type BoardTableCustomField = {
  id: number;
  name: string;
  type: "STRING" | "INTEGER";
  minValue: number | null;
  maxValue: number | null;
};

type BoardTableRow = {
  column: {
    name: string;
    color: string;
  };
  task: TaskDialogTask;
};

type BoardTableProps = {
  boardId: number;
  columns: BoardTableColumn[];
  boardLabels: {
    id: number;
    name: string;
  }[];
  boardCustomFields: BoardTableCustomField[];
  boardMembers: {
    id: number;
    name: string;
    email: string;
  }[];
  userName?: string | null;
  userEmail: string;
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

function getCustomFieldValue(task: TaskDialogTask, fieldId: number) {
  const value = task.customFieldValues.find(
    (customFieldValue) => customFieldValue.customFieldId === fieldId
  );

  return value?.stringValue ?? value?.integerValue ?? null;
}

function getChecklistSummary(task: TaskDialogTask) {
  if (!task.subTasks.length) {
    return "-";
  }

  const completedSubTasks = task.subTasks.filter(
    (subTask) => subTask.completedAt
  ).length;

  return `${completedSubTasks}/${task.subTasks.length}`;
}

function BoardTable({
  boardId,
  columns,
  boardLabels,
  boardCustomFields,
  boardMembers,
  userName,
  userEmail,
}: BoardTableProps) {
  const rows: BoardTableRow[] = columns.flatMap((column) =>
    column.tasks.map((task) => ({
      column: {
        name: column.name,
        color: column.color,
      },
      task,
    }))
  );
  const tableColumns: ColumnDef<BoardTableRow>[] = [
    {
      id: "name",
      header: "Nome",
      accessorFn: (row) => row.task.title,
      meta: {
        cellClassName: "p-0",
      },
      cell: ({ row }) => {
        const { column, task } = row.original;

        return (
          <TaskDialog
            boardId={boardId}
            columnName={column.name}
            columnColor={column.color}
            boardColumns={columns}
            task={task}
            boardLabels={boardLabels}
            boardCustomFields={boardCustomFields}
            boardMembers={boardMembers}
            userName={userName}
            userEmail={userEmail}
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
                  style={{ backgroundColor: column.color }}
                />
                <span className="truncate">{task.title}</span>
              </Button>
            }
          />
        );
      },
    },
    {
      id: "column",
      header: "Coluna",
      accessorFn: (row) => row.column.name,
      cell: ({ row }) => (
        <Badge
          variant="secondary"
          style={{ borderLeft: `3px solid ${row.original.column.color}` }}
        >
          {row.original.column.name}
        </Badge>
      ),
    },
    {
      id: "description",
      header: "Descricao",
      accessorFn: (row) => row.task.description ?? "",
      cell: ({ row }) => (
        <span className="block max-w-80 truncate text-muted-foreground">
          {row.original.task.description || "-"}
        </span>
      ),
    },
    {
      id: "members",
      header: "Membros",
      accessorFn: (row) =>
        row.task.assignees.map(({ user }) => user.name).join(" "),
      cell: ({ row }) => {
        const visibleAssignees = row.original.task.assignees.slice(0, 3);
        const remainingAssignees = Math.max(
          row.original.task.assignees.length - visibleAssignees.length,
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
      accessorFn: (row) => row.task.startDate?.getTime() ?? 0,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDateInputValue(row.original.task.startDate) || "-"}
        </span>
      ),
    },
    {
      id: "dueDate",
      header: "Data limite",
      accessorFn: (row) => row.task.dueDate?.getTime() ?? 0,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDateInputValue(row.original.task.dueDate) || "-"}
        </span>
      ),
    },
    {
      id: "completed",
      header: "Concluida",
      accessorFn: (row) => (row.task.completed ? 1 : 0),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.task.completed ? "Sim" : "Nao"}
        </span>
      ),
    },
    {
      id: "completedAt",
      header: "Data conclusao",
      accessorFn: (row) => row.task.completedAt?.getTime() ?? 0,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDateInputValue(row.original.task.completedAt) || "-"}
        </span>
      ),
    },
    {
      id: "labels",
      header: "Etiquetas",
      accessorFn: (row) =>
        row.task.labels.map(({ label }) => label.name).join(" "),
      cell: ({ row }) =>
        row.original.task.labels.length ? (
          <div className="flex flex-wrap gap-1">
            {row.original.task.labels.map(({ label }) => (
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
      accessorFn: (row) => {
        if (!row.task.subTasks.length) {
          return 0;
        }

        return (
          row.task.subTasks.filter((subTask) => subTask.completedAt).length /
          row.task.subTasks.length
        );
      },
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {getChecklistSummary(row.original.task)}
        </span>
      ),
    },
    ...boardCustomFields.map(
      (field): ColumnDef<BoardTableRow> => ({
        id: `customField:${field.id}`,
        header: field.name,
        accessorFn: (row) => getCustomFieldValue(row.task, field.id) ?? "",
        cell: ({ row }) => {
          const value = getCustomFieldValue(row.original.task, field.id);

          return (
            <span className="text-muted-foreground">
              {value === null || value === "" ? "-" : value}
            </span>
          );
        },
      })
    ),
  ];
  const initialColumnVisibility: VisibilityState = {
    checklist: false,
    column: false,
    completed: false,
    completedAt: false,
    description: false,
    ...Object.fromEntries(
      boardCustomFields.map((field) => [`customField:${field.id}`, false])
    ),
  };

  return (
    <DataTable
      columns={tableColumns}
      data={rows}
      initialColumnVisibility={initialColumnVisibility}
    />
  );
}

export { BoardTable };
