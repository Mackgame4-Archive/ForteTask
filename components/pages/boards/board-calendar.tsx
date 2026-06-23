"use client";

import { TaskCalendar, type CalendarItem } from "@/components/task-calendar";
import {
  TaskDialog,
  type TaskDialogTask,
} from "@/components/pages/boards/task-dialog";
import { cn } from "@/lib/utils";

type BoardCalendarColumn = {
  id: number;
  name: string;
  color: string;
  tasks: TaskDialogTask[];
};

type BoardCalendarTask = CalendarItem & {
  columnId: number;
  column: {
    name: string;
    color: string;
  } | null;
  board: {
    name: string;
  } | null;
  dialogTask: TaskDialogTask;
};

type BoardCalendarProps = {
  boardId: number;
  boardName: string;
  columns: BoardCalendarColumn[];
  boardLabels: {
    id: number;
    name: string;
  }[];
  boardCustomFields: {
    id: number;
    name: string;
    type: "STRING" | "INTEGER";
    minValue: number | null;
    maxValue: number | null;
  }[];
  boardMembers: {
    id: number;
    name: string;
    email: string;
  }[];
  userName?: string | null;
  userEmail: string;
};

function BoardCalendar({
  boardId,
  boardName,
  columns,
  boardLabels,
  boardCustomFields,
  boardMembers,
  userName,
  userEmail,
}: BoardCalendarProps) {
  const tasks: BoardCalendarTask[] = columns.flatMap((column) =>
    column.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      completed: task.completed,
      startDate: task.startDate?.toISOString() ?? null,
      dueDate: task.dueDate?.toISOString() ?? null,
      columnId: column.id,
      column: {
        name: column.name,
        color: column.color,
      },
      board: {
        name: boardName,
      },
      dialogTask: task,
    }))
  );

  return (
    <TaskCalendar
      items={tasks}
      summary={`${tasks.length} ${
        tasks.length === 1 ? "tarefa agendada" : "tarefas agendadas"
      }`}
      renderItem={(boardTask) => {
        return (
          <TaskDialog
            boardId={boardId}
            columnName={boardTask.column?.name ?? "Tarefa"}
            columnColor={boardTask.column?.color}
            task={boardTask.dialogTask}
            boardLabels={boardLabels}
            boardCustomFields={boardCustomFields}
            boardMembers={boardMembers}
            userName={userName}
            userEmail={userEmail}
            trigger={<BoardCalendarTaskTrigger task={boardTask} />}
          />
        );
      }}
    />
  );
}

function BoardCalendarTaskTrigger({ task }: { task: BoardCalendarTask }) {
  return (
    <div
      className={cn(
        "min-w-0 cursor-pointer border-l-2 bg-muted px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted/70",
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
      {task.column ? (
        <p className="truncate text-[11px] text-muted-foreground">
          {task.column.name}
        </p>
      ) : null}
    </div>
  );
}

export { BoardCalendar };
