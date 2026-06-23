"use client"

import { useState, type ReactNode } from "react"
import {
  CalendarClock,
  CheckSquare,
  List,
  MessageSquare,
  MoreHorizontal,
  SlidersHorizontal,
  Tag,
  Trash2,
  UserPlus,
  X,
} from "lucide-react"

import {
  deleteTaskAction,
  updateTaskAction,
} from "@/app/(root)/boards/actions"
import { DatePicker } from "@/components/date-picker"
import { Checklist } from "@/components/checklist"
import { InlineEditableField } from "@/components/ui/inline-editable-field"
import { MarkdownEditor } from "@/components/markdown-editor"
import { Multiselect } from "@/components/multiselect"
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
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatTimeInputValue } from "@/lib/utils/date"
import type { LucideIcon } from "lucide-react"

export type TaskDialogTask = TaskCardTask & {
  id: number
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
}

type TaskDialogProps = {
  boardId: number
  columnName: string
  columnColor?: string
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
  trigger?: ReactNode
}

type TaskSectionId = "members" | "labels" | "dates" | "checklist" | "customFields"

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

export function TaskDialog({
  boardId,
  columnName,
  columnColor,
  task,
  boardLabels,
  boardCustomFields,
  boardMembers,
  userName,
  userEmail,
  trigger,
}: TaskDialogProps) {
  const displayName = userName || userEmail
  const [title, setTitle] = useState(task.title)
  const [activeSections, setActiveSections] = useState<TaskSectionId[]>(
    [
      task.assignees.length ? "members" : null,
      task.labels.length ? "labels" : null,
      task.startDate || task.dueDate ? "dates" : null,
      task.subTasks.length ? "checklist" : null,
      task.customFieldValues.length ? "customFields" : null,
    ].filter(Boolean) as TaskSectionId[]
  )
  const customFieldValueById = new Map(
    task.customFieldValues.map((value) => [value.customFieldId, value])
  )

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
    <Dialog>
      <DialogTrigger
        nativeButton={false}
        render={<div className="block w-full" />}
      >
        {trigger ?? <TaskCard task={task} />}
      </DialogTrigger>
      <DialogContent
        className="max-h-[calc(100svh-2rem)] overflow-y-auto p-0 sm:max-w-5xl"
        showCloseButton={false}
      >
        <form id={`delete-task-${task.id}`} action={deleteTaskAction}>
          <input type="hidden" name="boardId" value={boardId} />
          <input type="hidden" name="taskId" value={task.id} />
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
              <Badge
                variant="secondary"
                className="text-xs"
                style={columnColor ? { borderLeft: `3px solid ${columnColor}` } : undefined}
              >
                {columnName}
              </Badge>
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
                <Button type="button" variant="outline" size="sm">
                  Mostrar detalhes
                </Button>
              </div>
              <Input readOnly value="" placeholder="Escrever um comentário..." />
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
