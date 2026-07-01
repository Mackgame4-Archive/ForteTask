"use client"

import { useState, type ReactNode } from "react"
import {
  CalendarClock,
  CheckSquare,
  Download,
  File,
  List,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  SlidersHorizontal,
  Tag,
  Trash2,
  UserPlus,
  X,
} from "lucide-react"

import {
  createTaskCommentAction,
  deleteTaskAction,
  deleteTaskAttachmentAction,
  uploadTaskAttachmentAction,
  updateTaskAction,
} from "@/app/(root)/boards/actions"
import { DatePicker } from "@/components/date-picker"
import { Checklist } from "@/components/checklist"
import { InlineEditableField } from "@/components/ui/inline-editable-field"
import { MarkdownEditor } from "@/components/markdown-editor"
import { Multiselect } from "@/components/multiselect"
import { BoardRedirectInput } from "@/components/pages/boards/board-redirect-input"
import TaskCard, { type TaskCardTask } from "@/components/pages/boards/task-card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatAppDate, formatTimeInputValue } from "@/lib/utils/date"
import type { LucideIcon } from "lucide-react"

export type TaskDialogTask = TaskCardTask & {
  id: number
  columnId: number
  subTasks: {
    id: number
    title: string
    completedAt: Date | null
  }[]
  customFieldValues: {
    customFieldId: number
    stringValue: string | null
    integerValue: number | null
  }[]
  attachments: {
    id: number
    fileName: string
    contentType: string
    size: number
    createdAt: Date
    uploadedBy: {
      id: number
      name: string
    } | null
  }[]
  comments: {
    id: number
    body: string
    createdAt: Date
    updatedAt: Date
    author: {
      id: number
      name: string
      email: string
    } | null
  }[]
  activities: {
    id: number
    type: string
    message: string
    createdAt: Date
    actor: {
      id: number
      name: string
      email: string
    } | null
  }[]
}

type TaskDialogProps = {
  boardId: number
  columnName: string
  columnColor?: string
  boardColumns: {
    id: number
    name: string
    color: string
  }[]
  task: TaskDialogTask
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
  onTaskCompletedChange?: (taskId: number, completed: boolean) => void
  trigger?: ReactNode
}

type TaskSectionId =
  | "members"
  | "labels"
  | "dates"
  | "checklist"
  | "attachments"
  | "customFields"

const taskSections: Record<
  TaskSectionId,
  {
    button: string
    title: string
    Icon: LucideIcon
  }
> = {
  members: {
    button: "Membros",
    title: "Membros",
    Icon: UserPlus,
  },
  labels: {
    button: "Etiquetas",
    title: "Etiquetas",
    Icon: Tag,
  },
  dates: {
    button: "Datas",
    title: "Datas",
    Icon: CalendarClock,
  },
  checklist: {
    button: "Checklist",
    title: "Checklist",
    Icon: CheckSquare,
  },
  attachments: {
    button: "Anexos",
    title: "Anexos",
    Icon: Paperclip,
  },
  customFields: {
    button: "Campos",
    title: "Campos personalizados",
    Icon: SlidersHorizontal,
  },
}

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  )
}

function formatFileSize(bytes: number) {
  const units = ["B", "KB", "MB", "GB"]
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size >= 10 || unitIndex === 0 ? Math.round(size) : size.toFixed(1)} ${units[unitIndex]}`
}

function formatTimelineDate(date: Date) {
  return formatAppDate(date, "dd MMM yyyy HH:mm")
}

export function TaskDialog({
  boardId,
  columnName,
  columnColor,
  boardColumns,
  task,
  boardLabels,
  boardCustomFields,
  boardMembers,
  userName,
  userEmail,
  onTaskCompletedChange,
  trigger,
}: TaskDialogProps) {
  const displayName = userName || userEmail
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [selectedColumnId, setSelectedColumnId] = useState(String(task.columnId))
  const selectedColumn = boardColumns.find(
    (column) => String(column.id) === selectedColumnId
  )
  const [activeSections, setActiveSections] = useState<TaskSectionId[]>(
    [
      task.assignees.length ? "members" : null,
      task.labels.length ? "labels" : null,
      task.startDate || task.dueDate ? "dates" : null,
      task.subTasks.length ? "checklist" : null,
      task.attachments.length ? "attachments" : null,
      task.customFieldValues.length ? "customFields" : null,
    ].filter(Boolean) as TaskSectionId[]
  )
  const customFieldValueById = new Map(
    task.customFieldValues.map((value) => [value.customFieldId, value])
  )
  const timelineItems = [
    ...task.comments.map((comment) => ({
      kind: "comment" as const,
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      name: comment.author?.name ?? "Utilizador removido",
      email: comment.author?.email,
    })),
    ...task.activities.map((activity) => ({
      kind: "activity" as const,
      id: activity.id,
      message: activity.message,
      createdAt: activity.createdAt,
      name: activity.actor?.name ?? "Sistema",
      email: activity.actor?.email,
    })),
  ].sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime())

  function addSection(section: TaskSectionId) {
    setActiveSections((currentSections) =>
      currentSections.includes(section)
        ? currentSections
        : [...currentSections, section]
    )
  }

  function removeSection(section: TaskSectionId) {
    setActiveSections((currentSections) =>
      currentSections.filter((currentSection) => currentSection !== section)
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setSelectedColumnId(String(task.columnId))
        setOpen(nextOpen)
      }}
    >
      <DialogTrigger
        nativeButton={false}
        render={<div className="block w-full" />}
      >
        {trigger ?? (
          <TaskCard
            boardId={boardId}
            task={task}
            onCompletedChange={(completed) =>
              onTaskCompletedChange?.(task.id, completed)
            }
          />
        )}
      </DialogTrigger>
      <DialogContent
        className="max-h-[calc(100svh-2rem)] overflow-y-auto p-0 sm:max-w-5xl"
        showCloseButton={false}
      >
        <form
          id={`upload-task-attachment-${task.id}`}
          action={uploadTaskAttachmentAction}
        >
          <input type="hidden" name="boardId" value={boardId} />
          <input type="hidden" name="taskId" value={task.id} />
          <BoardRedirectInput />
        </form>
        <form
          id={`create-task-comment-${task.id}`}
          action={createTaskCommentAction}
        >
          <input type="hidden" name="boardId" value={boardId} />
          <input type="hidden" name="taskId" value={task.id} />
          <BoardRedirectInput />
        </form>
        {task.attachments.map((attachment) => (
          <span key={attachment.id} className="contents">
            <form
              id={`delete-task-attachment-${attachment.id}`}
              action={deleteTaskAttachmentAction}
            >
              <input type="hidden" name="boardId" value={boardId} />
              <input type="hidden" name="taskId" value={task.id} />
              <input
                type="hidden"
                name="attachmentId"
                value={attachment.id}
              />
              <BoardRedirectInput />
            </form>
          </span>
        ))}
        <form id={`delete-task-${task.id}`} action={deleteTaskAction}>
          <input type="hidden" name="boardId" value={boardId} />
          <input type="hidden" name="taskId" value={task.id} />
          <BoardRedirectInput />
          <button
            id={`delete-task-submit-${task.id}`}
            type="submit"
            className="hidden"
            formNoValidate
          />
        </form>
        <form action={updateTaskAction}>
          <input type="hidden" name="boardId" value={boardId} />
          <input type="hidden" name="taskId" value={task.id} />
          <BoardRedirectInput />
          {boardCustomFields.map((field) => {
            const value = customFieldValueById.get(field.id)
            const fieldValue =
              field.type === "INTEGER"
                ? value?.integerValue == null
                  ? ""
                  : String(value.integerValue)
                : value?.stringValue ?? ""

            return (
              <input
                key={field.id}
                type="hidden"
                name={`customFieldValue:${field.id}`}
                value={fieldValue}
              />
            )
          })}
          <div className="border-b border-border bg-card px-6 pb-4">
            <header className="flex items-center justify-between gap-3">
              <Label htmlFor={`task-column-edit-${task.id}`} className="sr-only">
                Coluna
              </Label>
              <Select
                key={`${task.id}-${task.columnId}-${open ? "open" : "closed"}`}
                name="columnId"
                value={selectedColumnId}
                onValueChange={(value) => {
                  if (value) {
                    setSelectedColumnId(value)
                  }
                }}
              >
                <SelectTrigger
                  id={`task-column-edit-${task.id}`}
                  size="sm"
                  className="border-border bg-secondary text-secondary-foreground"
                  style={
                    selectedColumn?.color || columnColor
                      ? { borderLeft: `3px solid ${selectedColumn?.color ?? columnColor}` }
                      : undefined
                  }
                >
                  <SelectValue placeholder={columnName}>
                    {selectedColumn?.name ?? columnName}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectGroup>
                    {boardColumns.map((column) => (
                      <SelectItem
                        key={column.id}
                        value={String(column.id)}
                        label={column.name}
                      >
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
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Ações da tarefa"
                      />
                    }
                  >
                    <MoreHorizontal />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      render={
                        <label htmlFor={`delete-task-submit-${task.id}`} />
                      }
                      variant="destructive"
                    >
                      <Trash2 />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DialogClose
                  render={
                    <Button type="button" variant="ghost" size="icon-sm" />
                  }
                >
                  <X />
                  <span className="sr-only">Fechar</span>
                </DialogClose>
              </div>
            </header>
          </div>

          <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_28rem]">
            <div className="space-y-6 bg-card px-6 py-6">
              <DialogHeader className="gap-4">
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1 space-y-3">
                    <DialogTitle className="sr-only">Editar tarefa</DialogTitle>
                    <Label
                      htmlFor={`task-title-edit-${task.id}`}
                      className="sr-only"
                    >
                      Título
                    </Label>
                    <div className="flex items-center gap-3">
                      <Checkbox
                        name="completed"
                        value="true"
                        defaultChecked={task.completed}
                        aria-label="Marcar tarefa como concluída"
                        className="cursor-pointer"
                      />
                      <InlineEditableField
                        id={`task-title-edit-${task.id}`}
                        name="title"
                        value={title}
                        onChange={setTitle}
                        placeholder="Título da tarefa"
                        required
                        maxLength={255}
                        className="min-w-0 flex-1 text-2xl font-semibold md:text-2xl"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={activeSections.includes("labels")}
                        onClick={() => addSection("labels")}
                      >
                        <Tag />
                        {taskSections.labels.button}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={activeSections.includes("dates")}
                        onClick={() => addSection("dates")}
                      >
                        <CalendarClock />
                        {taskSections.dates.button}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={activeSections.includes("checklist")}
                        onClick={() => addSection("checklist")}
                      >
                        <CheckSquare />
                        {taskSections.checklist.button}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={activeSections.includes("attachments")}
                        onClick={() => addSection("attachments")}
                      >
                        <Paperclip />
                        {taskSections.attachments.button}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={activeSections.includes("members")}
                        onClick={() => addSection("members")}
                      >
                        <UserPlus />
                        Membros
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={activeSections.includes("customFields")}
                        onClick={() => addSection("customFields")}
                      >
                        <SlidersHorizontal />
                        {taskSections.customFields.button}
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <section className="space-y-3">
                <div className="flex items-center gap-3">
                  <List className="size-5 text-muted-foreground" />
                  <Label
                    htmlFor={`task-description-edit-${task.id}`}
                    className="font-semibold"
                  >
                    Descrição
                  </Label>
                </div>
                <MarkdownEditor
                  id={`task-description-edit-${task.id}`}
                  name="description"
                  defaultPreview
                  defaultValue={task.description ?? ""}
                  maxLength={1000}
                  placeholder="Adicione uma descrição mais detalhada..."
                />
              </section>

              {activeSections.map((section) => {
                const SectionIcon = taskSections[section].Icon

                return (
                  <section key={section} className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <SectionIcon className="size-5 text-muted-foreground" />
                        <h2 className="font-semibold">
                          {taskSections[section].title}
                        </h2>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Remover ${taskSections[section].title}`}
                        onClick={() => removeSection(section)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    {section === "members" ? (
                      <Multiselect
                        name="assigneeIds"
                        options={boardMembers.map((member) => ({
                          label: member.name,
                          value: String(member.id),
                        }))}
                        defaultValue={task.assignees.map(({ user }) =>
                          String(user.id)
                        )}
                        placeholder="Selecionar membros"
                        emptyText="Nenhum membro encontrado."
                      />
                    ) : null}
                    {section === "labels" ? (
                      <Multiselect
                        name="labelIds"
                        options={boardLabels.map((label) => ({
                          label: label.name,
                          value: String(label.id),
                        }))}
                        defaultValue={task.labels.map(({ label }) =>
                          String(label.id)
                        )}
                        placeholder="Selecionar etiqueta"
                        emptyText="Nenhuma etiqueta encontrada."
                      />
                    ) : null}
                    {section === "dates" ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <DatePicker
                          input
                          time
                          name="startDate"
                          timeName="startTime"
                          label="Data de início"
                          timeLabel="Hora de início"
                          defaultValue={task.startDate ?? undefined}
                          defaultTime={formatTimeInputValue(task.startDate)}
                        />
                        <DatePicker
                          input
                          time
                          name="dueDate"
                          timeName="dueTime"
                          label="Data limite"
                          timeLabel="Hora limite"
                          defaultValue={task.dueDate ?? undefined}
                          defaultTime={formatTimeInputValue(task.dueDate)}
                        />
                      </div>
                    ) : null}
                    {section === "checklist" ? (
                      <Checklist
                        items={task.subTasks.map((subTask) => ({
                          id: subTask.id,
                          title: subTask.title,
                          completed: Boolean(subTask.completedAt),
                        }))}
                      />
                    ) : null}
                    {section === "attachments" ? (
                      <div className="space-y-3">
                        <div className="grid gap-2">
                          <Label htmlFor={`task-attachment-${task.id}`}>
                            Ficheiro
                          </Label>
                          <Input
                            id={`task-attachment-${task.id}`}
                            type="file"
                            name="attachment"
                            form={`upload-task-attachment-${task.id}`}
                          />
                          <Button
                            type="submit"
                            form={`upload-task-attachment-${task.id}`}
                            variant="outline"
                            size="sm"
                            className="justify-self-start"
                          >
                            <Paperclip />
                            Anexar ficheiro
                          </Button>
                        </div>
                        {task.attachments.length ? (
                          <div className="grid gap-2">
                            {task.attachments.map((attachment) => (
                              <div
                                key={attachment.id}
                                className="flex items-center gap-3 border border-border bg-background p-2"
                              >
                                <File className="size-4 shrink-0 text-muted-foreground" />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">
                                    {attachment.fileName}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {formatFileSize(attachment.size)}
                                    {attachment.uploadedBy
                                      ? ` por ${attachment.uploadedBy.name}`
                                      : ""}
                                  </p>
                                </div>
                                <Button
                                  nativeButton={false}
                                  render={
                                    <a
                                      href={`/api/boards/${boardId}/tasks/${task.id}/attachments/${attachment.id}/download`}
                                    />
                                  }
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Descarregar ${attachment.fileName}`}
                                >
                                  <Download />
                                </Button>
                                <Button
                                  type="submit"
                                  form={`delete-task-attachment-${attachment.id}`}
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-muted-foreground hover:text-destructive"
                                  aria-label={`Eliminar ${attachment.fileName}`}
                                >
                                  <Trash2 />
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Esta tarefa ainda não tem anexos.
                          </p>
                        )}
                      </div>
                    ) : null}
                    {section === "customFields" ? (
                      boardCustomFields.length ? (
                        <div className="grid gap-3">
                          {boardCustomFields.map((field) => {
                            const value = customFieldValueById.get(field.id)
                            const inputName = `customFieldValue:${field.id}`

                            if (field.type === "STRING") {
                              return (
                                <div key={field.id} className="grid gap-2">
                                  <Label htmlFor={`custom-field-${task.id}-${field.id}`}>
                                    {field.name}
                                  </Label>
                                  <Input
                                    id={`custom-field-${task.id}-${field.id}`}
                                    name={inputName}
                                    defaultValue={value?.stringValue ?? ""}
                                    maxLength={255}
                                  />
                                </div>
                              )
                            }

                            const minValue = field.minValue ?? 0
                            const maxValue = field.maxValue ?? minValue
                            const options = Array.from(
                              { length: Math.max(maxValue - minValue + 1, 0) },
                              (_, index) => minValue + index
                            )

                            return (
                              <div key={field.id} className="grid gap-2">
                                <Label>{field.name}</Label>
                                <Select
                                  name={inputName}
                                  defaultValue={
                                    value?.integerValue == null
                                      ? undefined
                                      : String(value.integerValue)
                                  }
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Selecionar valor" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-64">
                                    <SelectGroup>
                                      <SelectItem value="__empty">
                                        Sem valor
                                      </SelectItem>
                                      {options.map((option) => (
                                        <SelectItem key={option} value={String(option)}>
                                          {option}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Este quadro ainda não tem campos personalizados.
                        </p>
                      )
                    ) : null}
                  </section>
                )
              })}
            </div>

            <aside className="space-y-4 border-t border-border bg-background px-6 py-6 md:border-l md:border-t-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 font-semibold">
                  <MessageSquare className="size-5 text-muted-foreground" />
                  Comentários e atividades
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`task-comment-${task.id}`} className="sr-only">
                  Escrever comentário
                </Label>
                <Textarea
                  id={`task-comment-${task.id}`}
                  name="body"
                  form={`create-task-comment-${task.id}`}
                  placeholder="Escrever um comentário..."
                  maxLength={2000}
                  className="min-h-20 bg-card"
                />
                <Button
                  type="submit"
                  form={`create-task-comment-${task.id}`}
                  size="sm"
                >
                  Comentar
                </Button>
              </div>
              <div className="space-y-4">
                {timelineItems.length ? (
                  timelineItems.map((item) => (
                    <div key={`${item.kind}-${item.id}`} className="flex gap-3 text-sm">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        {getInitials(item.name)}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {item.name}
                          </span>{" "}
                          {formatTimelineDate(item.createdAt)}
                        </p>
                        {item.kind === "comment" ? (
                          <p className="whitespace-pre-wrap break-words rounded-none border border-border bg-card p-3">
                            {item.body}
                          </p>
                        ) : (
                          <p className="text-muted-foreground">{item.message}</p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex gap-3 text-sm">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {getInitials(displayName)}
                    </span>
                    <p className="text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {displayName}
                      </span>{" "}
                      adicionou este cartão a {columnName}
                    </p>
                  </div>
                )}
              </div>
            </aside>
          </div>

          <DialogFooter className="border-t border-border bg-card px-6 py-4">
            <DialogClose
              render={<Button type="button" variant="outline" />}
            >
              Cancelar
            </DialogClose>
            <Button type="submit">Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
