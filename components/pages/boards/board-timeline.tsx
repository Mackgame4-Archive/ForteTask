"use client";

import { GanttTimeline, type GanttTimelineItem } from "@/components/gantt-timeline";
import {
  TaskDialog,
  type TaskDialogTask,
} from "@/components/pages/boards/task-dialog";
import { cn } from "@/lib/utils";

type BoardTimelineColumn = {
  id: number;
  name: string;
  color: string;
  tasks: TaskDialogTask[];
};

type BoardTimelineTask = GanttTimelineItem & {
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

type BoardTimelineProps = {
  boardId: number;
  boardName: string;
  columns: BoardTimelineColumn[];
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

function BoardTimeline({
  boardId,
  boardName,
  columns,
  boardLabels,
  boardCustomFields,
  boardMembers,
  userName,
  userEmail,
}: BoardTimelineProps) {
  const tasks: BoardTimelineTask[] = columns.flatMap((column) =>
    column.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      completed: task.completed,
      startDate: task.startDate?.toISOString() ?? null,
      dueDate: task.dueDate?.toISOString() ?? null,
      color: column.color,
      description: column.name,
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
    <GanttTimeline
      items={tasks}
      emptyText="Nenhuma tarefa com datas para mostrar."
      renderItem={(boardTask) => (
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
          trigger={<BoardTimelineTaskTrigger task={boardTask} />}
        />
      )}
    />
  );
}

function BoardTimelineTaskTrigger({ task }: { task: BoardTimelineTask }) {
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

export { BoardTimeline };
