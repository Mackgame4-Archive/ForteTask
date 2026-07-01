"use client"

import { useState, useTransition } from "react"
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"

import {
  createColumnAction,
  createTaskAction,
  deleteColumnAction,
  moveColumnAction,
  moveTaskAction,
  updateColumnAction,
} from "@/app/(root)/boards/actions"
import { ColorPickerField } from "@/components/color-picker-field"
import { DatePicker } from "@/components/date-picker"
import {
  DraggableItem,
  DropZone,
  type DropZoneReorderDetails,
} from "@/components/draggable"
import { Multiselect } from "@/components/multiselect"
import { BoardRedirectInput } from "@/components/pages/boards/board-redirect-input"
import { TaskDialog, type TaskDialogTask } from "@/components/pages/boards/task-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type BoardColumn = {
  id: number
  name: string
  color: string
  tasks: TaskDialogTask[]
}

type BoardKanbanProps = {
  boardId: number
  canManage: boolean
  columnsReorderable?: boolean
  columns: BoardColumn[]
  tasksReorderable?: boolean
  boardLabels: {
    id: number
    name: string
  }[]
  boardCustomFields: {
    id: number
    name: string
    type: "STRING" | "INTEGER"
    minValue: number | null
    maxValue: number | null
  }[]
  boardMembers: {
    id: number
    name: string
    email: string
  }[]
  userName?: string | null
  userEmail: string
}

type DraggedTask = {
  taskId: number
  sourceColumnId: number
}

type TaskDragPayload = DraggedTask & {
  type: "board-task"
}

type ColumnDragPayload = {
  type: "board-column"
  columnId: number
  sourceBoardId: number
}

type BoardDragPayload = TaskDragPayload | ColumnDragPayload

function moveTaskBetweenColumns({
  columns,
  draggedTask,
  targetColumnId,
  beforeTaskId,
}: {
  columns: BoardColumn[]
  draggedTask: DraggedTask
  targetColumnId: number
  beforeTaskId?: number
}) {
  const sourceColumn = columns.find(
    (column) => column.id === draggedTask.sourceColumnId
  )
  const task = sourceColumn?.tasks.find((item) => item.id === draggedTask.taskId)

  if (!sourceColumn || !task) {
    return columns
  }

  return columns.map((column) => {
    const withoutDraggedTask = column.tasks.filter(
      (item) => item.id !== draggedTask.taskId
    )

    if (column.id !== targetColumnId) {
      return column.id === draggedTask.sourceColumnId
        ? { ...column, tasks: withoutDraggedTask }
        : column
    }

    const insertAt = beforeTaskId
      ? withoutDraggedTask.findIndex((item) => item.id === beforeTaskId)
      : -1
    const nextTasks = [...withoutDraggedTask]

    nextTasks.splice(insertAt >= 0 ? insertAt : nextTasks.length, 0, {
      ...task,
      columnId: targetColumnId,
    })

    return {
      ...column,
      tasks: nextTasks,
    }
  })
}

function moveColumnBefore({
  columns,
  columnId,
  beforeColumnId,
}: {
  columns: BoardColumn[]
  columnId: number
  beforeColumnId?: number
}) {
  const column = columns.find((item) => item.id === columnId)

  if (!column) {
    return columns
  }

  const withoutColumn = columns.filter((item) => item.id !== columnId)
  const insertAt = beforeColumnId
    ? withoutColumn.findIndex((item) => item.id === beforeColumnId)
    : -1
  const nextColumns = [...withoutColumn]

  nextColumns.splice(insertAt >= 0 ? insertAt : nextColumns.length, 0, column)

  return nextColumns
}

function getNumericId(value?: string) {
  if (!value) {
    return undefined
  }

  const id = Number(value)

  return Number.isInteger(id) && id > 0 ? id : undefined
}

function getReorderBeforeId(reorder?: DropZoneReorderDetails) {
  return reorder?.type === "insert" ? getNumericId(reorder.beforeId) : undefined
}

function getReorderSwapId(reorder?: DropZoneReorderDetails) {
  return reorder?.type === "swap" ? getNumericId(reorder.targetId) : undefined
}

function swapTaskWithTarget({
  columns,
  draggedTask,
  targetTaskId,
}: {
  columns: BoardColumn[]
  draggedTask: DraggedTask
  targetTaskId: number
}) {
  if (draggedTask.taskId === targetTaskId) {
    return columns
  }

  const sourceColumn = columns.find(
    (column) => column.id === draggedTask.sourceColumnId
  )
  const targetColumn = columns.find((column) =>
    column.tasks.some((task) => task.id === targetTaskId)
  )
  const draggedItem = sourceColumn?.tasks.find(
    (task) => task.id === draggedTask.taskId
  )
  const targetItem = targetColumn?.tasks.find((task) => task.id === targetTaskId)

  if (!sourceColumn || !targetColumn || !draggedItem || !targetItem) {
    return columns
  }

  return columns.map((column) => {
    if (column.id !== sourceColumn.id && column.id !== targetColumn.id) {
      return column
    }

    return {
      ...column,
      tasks: column.tasks.map((task) => {
        if (task.id === draggedItem.id) {
          return {
            ...targetItem,
            columnId: sourceColumn.id,
          }
        }

        if (task.id === targetItem.id) {
          return {
            ...draggedItem,
            columnId: targetColumn.id,
          }
        }

        return task
      }),
    }
  })
}

function swapColumnWithTarget({
  columns,
  columnId,
  targetColumnId,
}: {
  columns: BoardColumn[]
  columnId: number
  targetColumnId: number
}) {
  if (columnId === targetColumnId) {
    return columns
  }

  const sourceIndex = columns.findIndex((column) => column.id === columnId)
  const targetIndex = columns.findIndex((column) => column.id === targetColumnId)

  if (sourceIndex < 0 || targetIndex < 0) {
    return columns
  }

  const nextColumns = [...columns]
  const sourceColumn = nextColumns[sourceIndex]

  nextColumns[sourceIndex] = nextColumns[targetIndex]
  nextColumns[targetIndex] = sourceColumn

  return nextColumns
}

function AddTaskSheet({
  boardId,
  column,
  boardLabels,
  boardMembers,
}: {
  boardId: number
  column: BoardColumn
  boardLabels: BoardKanbanProps["boardLabels"]
  boardMembers: BoardKanbanProps["boardMembers"]
}) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start p-6"
          />
        }
      >
        <Plus />
        Adicionar tarefa
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Adicionar tarefa</SheetTitle>
          <SheetDescription>Criar uma tarefa em {column.name}.</SheetDescription>
        </SheetHeader>
        <form action={createTaskAction} className="space-y-4 p-4">
          <input type="hidden" name="boardId" value={boardId} />
          <BoardRedirectInput />
          <input type="hidden" name="columnId" value={column.id} />
          <div className="space-y-2">
            <Label htmlFor={`task-title-${column.id}`}>Título</Label>
            <Input
              id={`task-title-${column.id}`}
              name="title"
              required
              maxLength={255}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`task-description-${column.id}`}>Descrição</Label>
            <Textarea
              id={`task-description-${column.id}`}
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
              input
              time
              name="startDate"
              timeName="startTime"
              label="Data de início"
              timeLabel="Hora de início"
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
      </SheetContent>
    </Sheet>
  )
}

function AddColumnSheet({ boardId }: { boardId: number }) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <button
            type="button"
            className="flex h-40 w-80 shrink-0 flex-col items-center justify-center gap-3 border border-dashed border-border bg-card p-6 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          />
        }
      >
        <Plus className="size-5" />
        Adicionar coluna
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Adicionar coluna</SheetTitle>
          <SheetDescription>
            Criar uma nova coluna Kanban neste quadro.
          </SheetDescription>
        </SheetHeader>
        <form action={createColumnAction} className="space-y-4 p-4">
          <input type="hidden" name="boardId" value={boardId} />
          <div className="space-y-2">
            <Label htmlFor="column-name">Nome</Label>
            <Input id="column-name" name="name" required maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label>Cor</Label>
            <ColorPickerField
              name="color"
              defaultValue="#3b82f6"
              swatches={["#facc15", "#22c55e", "#3b82f6"]}
              disableTransparency
            />
          </div>
          <Button type="submit" className="w-full">
            Criar coluna
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function EditColumnSheet({
  boardId,
  column,
  onOpenChange,
}: {
  boardId: number
  column: BoardColumn | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={Boolean(column)} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Editar coluna</SheetTitle>
          <SheetDescription>
            Altere o nome e a cor desta coluna.
          </SheetDescription>
        </SheetHeader>
        {column ? (
          <form action={updateColumnAction} className="space-y-4 p-4">
            <input type="hidden" name="boardId" value={boardId} />
            <input type="hidden" name="columnId" value={column.id} />
            <div className="space-y-2">
              <Label htmlFor={`column-name-edit-${column.id}`}>Nome</Label>
              <Input
                id={`column-name-edit-${column.id}`}
                name="name"
                defaultValue={column.name}
                required
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <ColorPickerField
                name="color"
                defaultValue={column.color}
                swatches={["#facc15", "#22c55e", "#3b82f6"]}
                disableTransparency
              />
            </div>
            <Button type="submit" className="w-full">
              Guardar coluna
            </Button>
          </form>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

export function BoardKanban({
  boardId,
  canManage,
  columnsReorderable = true,
  columns: initialColumns,
  tasksReorderable = true,
  boardLabels,
  boardCustomFields,
  boardMembers,
  userName,
  userEmail,
}: BoardKanbanProps) {
  const [columns, setColumns] = useState(initialColumns)
  const [editingColumnId, setEditingColumnId] = useState<number | null>(null)
  const [, startTransition] = useTransition()
  const editingColumn =
    columns.find((column) => column.id === editingColumnId) ?? null

  function persistMove(
    nextColumns: BoardColumn[],
    targetColumnId: number,
    draggedTask: DraggedTask
  ) {
    const sourceColumn = nextColumns.find(
      (column) => column.id === draggedTask.sourceColumnId
    )
    const targetColumn = nextColumns.find((column) => column.id === targetColumnId)

    if (!sourceColumn || !targetColumn) {
      return
    }

    const formData = new FormData()
    formData.set("boardId", String(boardId))
    formData.set("taskId", String(draggedTask.taskId))
    formData.set("sourceColumnId", String(draggedTask.sourceColumnId))
    formData.set("targetColumnId", String(targetColumnId))

    sourceColumn.tasks.forEach((task) => {
      formData.append("sourceTaskIds", String(task.id))
    })
    targetColumn.tasks.forEach((task) => {
      formData.append("targetTaskIds", String(task.id))
    })

    startTransition(async () => {
      await moveTaskAction(formData)
    })
  }

  function dropTask(
    draggedTask: DraggedTask,
    targetColumnId: number,
    reorder?: DropZoneReorderDetails
  ) {
    if (
      !tasksReorderable &&
      draggedTask.sourceColumnId === targetColumnId
    ) {
      return
    }

    const swapTaskId = getReorderSwapId(reorder)
    const beforeTaskId = getReorderBeforeId(reorder)

    if (swapTaskId === draggedTask.taskId || beforeTaskId === draggedTask.taskId) {
      return
    }

    const nextColumns = swapTaskId
      ? swapTaskWithTarget({
          columns,
          draggedTask,
          targetTaskId: swapTaskId,
        })
      : moveTaskBetweenColumns({
          columns,
          draggedTask,
          targetColumnId,
          beforeTaskId,
        })

    setColumns(nextColumns)
    persistMove(nextColumns, targetColumnId, draggedTask)
  }

  function persistColumnMove(nextColumns: BoardColumn[], columnId: number) {
    const formData = new FormData()
    formData.set("boardId", String(boardId))
    formData.set("columnId", String(columnId))

    nextColumns.forEach((column) => {
      formData.append("columnIds", String(column.id))
    })

    startTransition(async () => {
      await moveColumnAction(formData)
    })
  }

  function updateTaskCompleted(taskId: number, completed: boolean) {
    setColumns((currentColumns) =>
      currentColumns.map((column) => ({
        ...column,
        tasks: column.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                completed,
                completedAt: completed
                  ? task.completedAt ?? new Date()
                  : null,
              }
            : task
        ),
      }))
    )
  }

  function dropColumn(
    columnId: number,
    reorder?: DropZoneReorderDetails,
    fallbackBeforeId?: number
  ) {
    if (!columnsReorderable) {
      return
    }

    const swapColumnId = getReorderSwapId(reorder)
    const beforeColumnId = getReorderBeforeId(reorder) ?? fallbackBeforeId

    if (swapColumnId === columnId || beforeColumnId === columnId) {
      return
    }

    const nextColumns = swapColumnId
      ? swapColumnWithTarget({
          columns,
          columnId,
          targetColumnId: swapColumnId,
        })
      : moveColumnBefore({
          columns,
          columnId,
          beforeColumnId,
        })

    setColumns(nextColumns)
    persistColumnMove(nextColumns, columnId)
  }

  return (
    <>
      <EditColumnSheet
        boardId={boardId}
        column={editingColumn}
        onOpenChange={(open) => {
          if (!open) {
            setEditingColumnId(null)
          }
        }}
      />
      <DropZone<BoardDragPayload>
        className="mx-auto flex w-max min-w-full max-w-7xl gap-4"
        reorderable={columnsReorderable}
        zoneId={boardId}
        getPayloadZoneId={(payload) =>
          payload.type === "board-column" ? payload.sourceBoardId : undefined
        }
        reorder={(payload) =>
          payload.type === "board-column"
            ? {
                group: "columns",
                orientation: "horizontal",
              }
            : null
        }
        onDropPayload={(payload, _event, reorder) => {
          if (payload.type === "board-column") {
            dropColumn(payload.columnId, reorder)
          }
        }}
      >
      {columns.map((column) => (
        <DraggableItem<ColumnDragPayload>
          key={column.id}
          payload={{
            type: "board-column",
            columnId: column.id,
            sourceBoardId: boardId,
          }}
          disabled={!canManage || !columnsReorderable}
          className="shrink-0"
          reorderGroup="columns"
          reorderId={column.id}
          draggingClassName="opacity-60"
        >
          <DropZone<BoardDragPayload>
            className="flex h-[calc(100svh-12rem)] w-80 flex-col border border-border bg-card"
            activeClassName="bg-muted/40"
            reorderable={columnsReorderable}
            zoneId={boardId}
            getPayloadZoneId={(payload) =>
              payload.type === "board-column" ? payload.sourceBoardId : undefined
            }
            reorder={(payload) =>
              payload.type === "board-task"
                ? {
                    group: "tasks",
                    orientation: "vertical",
                  }
                : {
                    group: "columns",
                    orientation: "horizontal",
                  }
            }
            onDropPayload={(payload, _event, reorder) => {
              if (payload.type === "board-task") {
                dropTask(payload, column.id, reorder)
              }
              if (payload.type === "board-column") {
                dropColumn(payload.columnId, reorder, column.id)
              }
            }}
            reorderGroup="columns"
            reorderId={column.id}
          >
            <div
              className={cn(
                "flex cursor-grab items-center justify-between gap-3 border-b border-border px-4 py-3 active:cursor-grabbing",
                (!canManage || !columnsReorderable) && "cursor-default"
              )}
              style={{ borderTop: `3px solid ${column.color}` }}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: column.color }}
                />
                <h2 className="truncate text-sm font-semibold">{column.name}</h2>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">
                  {column.tasks.length}
                </span>
                {canManage ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Ações para ${column.name}`}
                        />
                      }
                    >
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditingColumnId(column.id)}>
                        <Pencil />
                        Editar coluna
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        nativeButton
                        className="w-full"
                        render={
                          <button
                            type="submit"
                            form={`delete-column-${column.id}`}
                          />
                        }
                        variant="destructive"
                      >
                        <Trash2 />
                        Eliminar coluna
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            </div>
            {canManage ? (
              <form id={`delete-column-${column.id}`} action={deleteColumnAction}>
                <input type="hidden" name="boardId" value={boardId} />
                <input type="hidden" name="columnId" value={column.id} />
              </form>
            ) : null}

            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              {column.tasks.length > 0 ? (
                column.tasks.map((task) => (
                  <DraggableItem<TaskDragPayload>
                    key={task.id}
                    payload={{
                      type: "board-task",
                      taskId: task.id,
                      sourceColumnId: column.id,
                    }}
                    className="cursor-grab active:cursor-grabbing"
                    reorderGroup="tasks"
                    reorderId={task.id}
                    draggingClassName="opacity-60"
                  >
                    <DropZone<TaskDragPayload>
                      reorderable={tasksReorderable}
                      zoneId={column.id}
                      getPayloadZoneId={(payload) => payload.sourceColumnId}
                      reorder={{
                        group: "tasks",
                        orientation: "vertical",
                      }}
                      reorderGroup="tasks"
                      reorderId={task.id}
                      onDropPayload={(payload, _event, reorder) => {
                        if (payload.type === "board-task") {
                          dropTask(payload, column.id, reorder)
                        }
                      }}
                    >
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
                        onTaskCompletedChange={updateTaskCompleted}
                      />
                    </DropZone>
                  </DraggableItem>
                ))
              ) : (
                <p className="border border-dashed border-border bg-background px-3 py-4 text-center text-sm text-muted-foreground">
                  Ainda não existem tarefas.
                </p>
              )}
            </div>

            <div className="border-t border-border">
              <AddTaskSheet
                boardId={boardId}
                column={column}
                boardLabels={boardLabels}
                boardMembers={boardMembers}
              />
            </div>
          </DropZone>
        </DraggableItem>
      ))}
      {canManage ? (
        <DropZone<BoardDragPayload>
          reorderable={columnsReorderable}
          zoneId={boardId}
          getPayloadZoneId={(payload) =>
            payload.type === "board-column" ? payload.sourceBoardId : undefined
          }
          reorder={(payload) =>
            payload.type === "board-column"
              ? {
                  group: "columns",
                  orientation: "horizontal",
                }
              : null
          }
          onDropPayload={(payload, _event, reorder) => {
            if (payload.type === "board-column") {
              dropColumn(payload.columnId, reorder)
            }
          }}
        >
          <AddColumnSheet boardId={boardId} />
        </DropZone>
      ) : null}
      <div aria-hidden className="w-4 shrink-0" />
      </DropZone>
    </>
  )
}
