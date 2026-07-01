"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListFilter } from "lucide-react";

import {
  createTaskAction,
  toggleTaskCompletedAction,
  updateTaskDatesAction,
} from "@/app/(root)/boards/actions";
import { CheckIconSwitch } from "@/components/checkicon-switch";
import { DatePicker } from "@/components/date-picker";
import { DraggableItem } from "@/components/draggable";
import { Multiselect } from "@/components/multiselect";
import { BoardRedirectInput } from "@/components/pages/boards/board-redirect-input";
import {
  TaskCalendar,
  type CalendarItem,
  type CalendarItemRenderContext,
} from "@/components/task-calendar";
import {
  TaskDialog,
  type TaskDialogTask,
} from "@/components/pages/boards/task-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatDateInputValue, parseDateValue } from "@/lib/utils/date";
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

type CalendarTaskStatusFilter = "all" | "open" | "completed";

const calendarStatusLabels: Record<CalendarTaskStatusFilter, string> = {
  all: "Todas",
  open: "Por concluir",
  completed: "Concluidas",
};

type BoardCalendarDragPayload = {
  type: "board-calendar-task-date";
  boardId: number;
  edge: "start" | "end";
  dueDate: string | null;
  startDate: string | null;
  taskId: number;
};

function isBoardCalendarDragPayload(
  payload: Record<string, unknown>
): payload is BoardCalendarDragPayload {
  return (
    payload.type === "board-calendar-task-date" &&
    payload.boardId != null &&
    payload.taskId != null &&
    (payload.edge === "start" || payload.edge === "end")
  );
}

function startOfDateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function canDropTaskDate(payload: Record<string, unknown>, day: Date) {
  if (!isBoardCalendarDragPayload(payload)) {
    return false;
  }

  const targetDay = startOfDateOnly(day);
  const startDate = parseDateValue(payload.startDate);
  const dueDate = parseDateValue(payload.dueDate);

  if (payload.edge === "start") {
    return !dueDate || targetDay <= startOfDateOnly(dueDate);
  }

  return !startDate || targetDay >= startOfDateOnly(startDate);
}

function getTaskDragEdge(context: CalendarItemRenderContext) {
  if (context.position === "middle") {
    return null;
  }

  return context.position === "end" ? "end" : "start";
}

function serializeCalendarDate(value: CalendarItem["startDate"]) {
  return value instanceof Date ? value.toISOString() : value;
}

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
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] =
    useState<CalendarTaskStatusFilter>("all");
  const [newTaskDate, setNewTaskDate] = useState<Date | null>(null);
  const tasks: BoardCalendarTask[] = useMemo(
    () =>
      columns.flatMap((column) =>
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
      ),
    [boardName, columns]
  );
  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const labelIds = task.dialogTask.labels.map(({ label }) =>
          String(label.id)
        );
        const assigneeIds = task.dialogTask.assignees.map(({ user }) =>
          String(user.id)
        );

        return (
          (selectedColumnIds.length === 0 ||
            selectedColumnIds.includes(String(task.columnId))) &&
          (selectedLabelIds.length === 0 ||
            selectedLabelIds.every((labelId) => labelIds.includes(labelId))) &&
          (selectedMemberIds.length === 0 ||
            selectedMemberIds.every((memberId) =>
              assigneeIds.includes(memberId)
            )) &&
          (statusFilter === "all" ||
            (statusFilter === "completed" && task.completed) ||
            (statusFilter === "open" && !task.completed))
        );
      }),
    [selectedColumnIds, selectedLabelIds, selectedMemberIds, statusFilter, tasks]
  );
  const filtersActive =
    selectedColumnIds.length > 0 ||
    selectedLabelIds.length > 0 ||
    selectedMemberIds.length > 0 ||
    statusFilter !== "all";

  function updateTaskDate(payload: Record<string, unknown>, day: Date) {
    if (!canDropTaskDate(payload, day) || !isBoardCalendarDragPayload(payload)) {
      return;
    }

    const formData = new FormData();
    formData.set("boardId", String(payload.boardId));
    formData.set("taskId", String(payload.taskId));
    formData.set("edge", payload.edge);
    formData.set("targetDate", formatDateInputValue(day));

    startTransition(async () => {
      const result = await updateTaskDatesAction(formData);

      if (result?.error) {
        window.alert(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <>
      <AddCalendarTaskSheet
        key={newTaskDate?.toISOString() ?? "closed"}
        boardId={boardId}
        columns={columns}
        boardLabels={boardLabels}
        boardMembers={boardMembers}
        startDate={newTaskDate}
        onOpenChange={(open) => {
          if (!open) {
            setNewTaskDate(null);
          }
        }}
      />
      <TaskCalendar
        items={filteredTasks}
        summary={
          filtersActive
            ? `${filteredTasks.length} de ${tasks.length} tarefas agendadas`
            : `${tasks.length} ${
                tasks.length === 1 ? "tarefa agendada" : "tarefas agendadas"
              }`
        }
        headerActions={
          <BoardCalendarFilters
            columns={columns}
            boardLabels={boardLabels}
            boardMembers={boardMembers}
            selectedColumnIds={selectedColumnIds}
            selectedLabelIds={selectedLabelIds}
            selectedMemberIds={selectedMemberIds}
            statusFilter={statusFilter}
            onColumnIdsChange={setSelectedColumnIds}
            onLabelIdsChange={setSelectedLabelIds}
            onMemberIdsChange={setSelectedMemberIds}
            onStatusFilterChange={setStatusFilter}
            onClear={() => {
              setSelectedColumnIds([]);
              setSelectedLabelIds([]);
              setSelectedMemberIds([]);
              setStatusFilter("all");
            }}
          />
        }
        canDropOnDay={canDropTaskDate}
        onDayDrop={updateTaskDate}
        onDayDoubleClick={(day) => {
          if (columns.length > 0) {
            setNewTaskDate(day);
          }
        }}
        renderItem={(boardTask, context) => (
          <BoardCalendarTask
            boardId={boardId}
            columns={columns}
            boardTask={boardTask}
            boardLabels={boardLabels}
            boardCustomFields={boardCustomFields}
            boardMembers={boardMembers}
            context={context}
            userName={userName}
            userEmail={userEmail}
          />
        )}
      />
    </>
  );
}

function BoardCalendarTask({
  boardId,
  columns,
  boardTask,
  boardLabels,
  boardCustomFields,
  boardMembers,
  context,
  userName,
  userEmail,
}: {
  boardId: number;
  columns: BoardCalendarColumn[];
  boardTask: BoardCalendarTask;
  boardLabels: BoardCalendarProps["boardLabels"];
  boardCustomFields: BoardCalendarProps["boardCustomFields"];
  boardMembers: BoardCalendarProps["boardMembers"];
  context: CalendarItemRenderContext;
  userName?: string | null;
  userEmail: string;
}) {
  const edge = getTaskDragEdge(context);
  const taskDialog = (
    <TaskDialog
      boardId={boardId}
      columnName={boardTask.column?.name ?? "Tarefa"}
      columnColor={boardTask.column?.color}
      boardColumns={columns}
      task={boardTask.dialogTask}
      boardLabels={boardLabels}
      boardCustomFields={boardCustomFields}
      boardMembers={boardMembers}
      userName={userName}
      userEmail={userEmail}
      trigger={
        <BoardCalendarTaskTrigger
          key={`${boardTask.id}-${boardTask.completed}`}
          boardId={boardId}
          task={boardTask}
          position={context.position}
        />
      }
    />
  );

  if (!edge) {
    return taskDialog;
  }

  return (
    <DraggableItem<BoardCalendarDragPayload>
      payload={{
        type: "board-calendar-task-date",
        boardId,
        edge,
        dueDate: serializeCalendarDate(boardTask.dueDate),
        startDate: serializeCalendarDate(boardTask.startDate),
        taskId: Number(boardTask.id),
      }}
      draggingClassName="opacity-60"
    >
      {taskDialog}
    </DraggableItem>
  );
}

function BoardCalendarFilters({
  columns,
  boardLabels,
  boardMembers,
  selectedColumnIds,
  selectedLabelIds,
  selectedMemberIds,
  statusFilter,
  onColumnIdsChange,
  onLabelIdsChange,
  onMemberIdsChange,
  onStatusFilterChange,
  onClear,
}: {
  columns: BoardCalendarColumn[];
  boardLabels: BoardCalendarProps["boardLabels"];
  boardMembers: BoardCalendarProps["boardMembers"];
  selectedColumnIds: string[];
  selectedLabelIds: string[];
  selectedMemberIds: string[];
  statusFilter: CalendarTaskStatusFilter;
  onColumnIdsChange: (value: string[]) => void;
  onLabelIdsChange: (value: string[]) => void;
  onMemberIdsChange: (value: string[]) => void;
  onStatusFilterChange: (value: CalendarTaskStatusFilter) => void;
  onClear: () => void;
}) {
  const activeFilterCount = [
    selectedColumnIds.length > 0,
    selectedLabelIds.length > 0,
    selectedMemberIds.length > 0,
    statusFilter !== "all",
  ].filter(Boolean).length;

  return (
    <Popover>
      <PopoverTrigger
        render={<Button type="button" variant="outline" size="sm" />}
      >
        <ListFilter />
        Filtrar{activeFilterCount ? ` (${activeFilterCount})` : ""}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="end">
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label>Colunas</Label>
            <Multiselect
              value={selectedColumnIds}
              onValueChange={onColumnIdsChange}
              options={columns.map((column) => ({
                label: column.name,
                value: String(column.id),
              }))}
              placeholder="Selecionar colunas"
              emptyText="Nenhuma coluna encontrada."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Etiquetas</Label>
            <Multiselect
              value={selectedLabelIds}
              onValueChange={onLabelIdsChange}
              options={boardLabels.map((label) => ({
                label: label.name,
                value: String(label.id),
              }))}
              placeholder="Selecionar etiquetas"
              emptyText="Nenhuma etiqueta encontrada."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Membros</Label>
            <Multiselect
              value={selectedMemberIds}
              onValueChange={onMemberIdsChange}
              options={boardMembers.map((member) => ({
                label: member.name,
                value: String(member.id),
              }))}
              placeholder="Selecionar membros"
              emptyText="Nenhum membro encontrado."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Estado</Label>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                if (value) {
                  onStatusFilterChange(value as CalendarTaskStatusFilter);
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>{calendarStatusLabels[statusFilter]}</SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="open">Por concluir</SelectItem>
                  <SelectItem value="completed">Concluidas</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-self-end"
            onClick={onClear}
          >
            Limpar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AddCalendarTaskSheet({
  boardId,
  columns,
  boardLabels,
  boardMembers,
  startDate,
  onOpenChange,
}: {
  boardId: number;
  columns: BoardCalendarColumn[];
  boardLabels: BoardCalendarProps["boardLabels"];
  boardMembers: BoardCalendarProps["boardMembers"];
  startDate: Date | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [selectedColumnId, setSelectedColumnId] = useState(
    columns[0] ? String(columns[0].id) : ""
  );
  const selectedColumn = columns.find(
    (column) => String(column.id) === selectedColumnId
  );

  return (
    <Sheet open={Boolean(startDate)} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Adicionar tarefa</SheetTitle>
          <SheetDescription>
            Criar uma tarefa com data de inicio no dia selecionado.
          </SheetDescription>
        </SheetHeader>
        {startDate && selectedColumn ? (
          <form action={createTaskAction} className="space-y-4 p-4">
            <input type="hidden" name="boardId" value={boardId} />
            <BoardRedirectInput />
            <div className="space-y-2">
              <Label htmlFor="calendar-task-column">Coluna</Label>
              <Select
                name="columnId"
                value={selectedColumnId}
                onValueChange={(value) => {
                  if (value) {
                    setSelectedColumnId(value);
                  }
                }}
              >
                <SelectTrigger
                  id="calendar-task-column"
                  className="w-full"
                  style={{ borderLeft: `3px solid ${selectedColumn.color}` }}
                >
                  <SelectValue placeholder="Selecionar coluna">
                    {selectedColumn.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectGroup>
                    {columns.map((column) => (
                      <SelectItem key={column.id} value={String(column.id)}>
                        <span
                          className="size-2 shrink-0"
                          style={{ backgroundColor: column.color }}
                        />
                        {column.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="calendar-task-title">Titulo</Label>
              <Input
                id="calendar-task-title"
                name="title"
                required
                maxLength={255}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calendar-task-description">Descricao</Label>
              <Textarea
                id="calendar-task-description"
                name="description"
                maxLength={1000}
              />
            </div>
            <div className="space-y-2">
              <Label>Etiquetas</Label>
              <Multiselect
                name="labelIds"
                defaultValue={[]}
                options={boardLabels.map((label) => ({
                  label: label.name,
                  value: String(label.id),
                }))}
                placeholder="Selecionar etiqueta"
                emptyText="Nenhuma etiqueta encontrada."
              />
            </div>
            <div className="space-y-2">
              <Label>Membros</Label>
              <Multiselect
                name="assigneeIds"
                defaultValue={[]}
                options={boardMembers.map((member) => ({
                  label: member.name,
                  value: String(member.id),
                }))}
                placeholder="Selecionar membros"
                emptyText="Nenhum membro encontrado."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <DatePicker
                key={startDate.toISOString()}
                input
                time
                name="startDate"
                timeName="startTime"
                label="Data de inicio"
                timeLabel="Hora de inicio"
                defaultValue={startDate}
              />
              <DatePicker
                input
                time
                name="dueDate"
                timeName="dueTime"
                label="Data limite"
                timeLabel="Hora limite"
              />
            </div>
            <Button type="submit" className="w-full">
              Criar tarefa
            </Button>
          </form>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            Este quadro precisa de uma coluna antes de criar tarefas.
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}

function BoardCalendarTaskTrigger({
  boardId,
  position,
  task,
}: {
  boardId: number;
  position: CalendarItemRenderContext["position"];
  task: BoardCalendarTask;
}) {
  const router = useRouter();
  const [completed, setCompleted] = useState(task.completed ?? false);
  const [, startTransition] = useTransition();
  const color = task.column?.color ?? "var(--primary)";
  const showStartBar = position === "start" || position === "single";
  const showEndBar = position === "end" || position === "single";
  const showTaskControls = position === "start" || position === "single";
  const visibleAssignees = task.dialogTask.assignees.slice(0, 2);
  const remainingAssignees = Math.max(
    task.dialogTask.assignees.length - visibleAssignees.length,
    0
  );

  function toggleCompleted(nextCompleted: boolean) {
    const previousCompleted = completed;

    setCompleted(nextCompleted);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("boardId", String(boardId));
      formData.set("taskId", String(task.id));
      formData.set("completed", String(nextCompleted));

      const result = await toggleTaskCompletedAction(formData);

      if (result?.error) {
        setCompleted(previousCompleted);
        window.alert(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "min-w-0 cursor-pointer border-l-0 border-r-0 bg-muted px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted/70",
        showStartBar && "border-l-2",
        showEndBar && "border-r-2",
        completed && "text-muted-foreground line-through"
      )}
      style={{
        borderLeftColor: showStartBar ? color : undefined,
        borderRightColor: showEndBar ? color : undefined,
      }}
      title={[task.title, task.board?.name, task.column?.name]
        .filter(Boolean)
        .join(" - ")}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {showTaskControls ? (
          <CheckIconSwitch
            checked={completed}
            className="size-4 [&_svg]:size-3.5"
            label={
              completed
                ? "Marcar tarefa como por concluir"
                : "Marcar tarefa como concluida"
            }
            onCheckedChange={toggleCompleted}
          />
        ) : null}
        <p className="min-w-0 flex-1 truncate font-medium">{task.title}</p>
        {showTaskControls && visibleAssignees.length ? (
          <AvatarGroup
            className="shrink-0 -space-x-1.5"
            onClick={(event) => event.stopPropagation()}
          >
            {visibleAssignees.map(({ user }) => (
              <Avatar key={user.id} size="sm" title={user.name}>
                <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
              </Avatar>
            ))}
            {remainingAssignees ? (
              <AvatarGroupCount>+{remainingAssignees}</AvatarGroupCount>
            ) : null}
          </AvatarGroup>
        ) : null}
      </div>
      {task.column ? (
        <p
          className={cn(
            "truncate text-[11px] text-muted-foreground",
            showTaskControls && "pl-5"
          )}
        >
          {task.column.name}
        </p>
      ) : null}
    </div>
  );
}

export { BoardCalendar };
