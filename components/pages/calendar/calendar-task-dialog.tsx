"use client";

import { type ReactNode } from "react";
import { CalendarClock, CheckCircle2, CheckSquare, Circle, List, Tag, Users, X } from "lucide-react";

import type { CalendarTask } from "@/services/tasks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import { formatDateInputValue, formatTimeInputValue, parseDateValue } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

type CalendarTaskDialogProps = {
  task: CalendarTask;
  trigger?: ReactNode;
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

function formatDateTime(value: string | null) {
  const date = parseDateValue(value);

  if (!date) {
    return null;
  }

  return `${formatDateInputValue(date)} ${formatTimeInputValue(date, "00:00")}`;
}

function CalendarTaskDialog({ task, trigger }: CalendarTaskDialogProps) {
  const visibleAssignees = task.assignees.slice(0, 4);
  const remainingAssignees = Math.max(task.assignees.length - visibleAssignees.length, 0);
  const startDate = formatDateTime(task.startDate);
  const dueDate = formatDateTime(task.dueDate);
  const completedAt = formatDateTime(task.completedAt);

  return (
    <Dialog>
      <DialogTrigger
        nativeButton={false}
        render={<div className="block" />}
      >
        {trigger ?? <CalendarTaskTrigger task={task} />}
      </DialogTrigger>
      <DialogContent
        className="max-h-[calc(100svh-2rem)] overflow-y-auto p-0 sm:max-w-4xl"
        showCloseButton={false}
      >
        <div className="border-b border-border bg-card px-6 py-4">
          <header className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {task.board ? <Badge variant="outline">{task.board.name}</Badge> : null}
              {task.column ? (
                <Badge variant="secondary" style={{ borderLeft: `3px solid ${task.column.color}` }}>
                  {task.column.name}
                </Badge>
              ) : null}
            </div>
            <DialogClose
              render={<Button type="button" variant="ghost" size="icon-sm" />}
            >
              <X />
              <span className="sr-only">Fechar</span>
            </DialogClose>
          </header>
        </div>

        <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-6 bg-card px-6 py-6">
            <DialogHeader className="gap-3">
              <div className="flex items-start gap-3">
                {task.completed ? (
                  <CheckCircle2 className="mt-1 size-5 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className="mt-1 size-5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-2xl font-semibold">
                    {task.title}
                  </DialogTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {task.completed ? "Tarefa concluída" : "Tarefa aberta"}
                  </p>
                </div>
              </div>
            </DialogHeader>

            <section className="space-y-3">
              <div className="flex items-center gap-3 font-semibold">
                <List className="size-5 text-muted-foreground" />
                Descrição
              </div>
              {task.description ? (
                <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {task.description}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sem descrição.
                </p>
              )}
            </section>

            {task.subTasks.length ? (
              <section className="space-y-3">
                <div className="flex items-center gap-3 font-semibold">
                  <CheckSquare className="size-5 text-muted-foreground" />
                  Checklist
                </div>
                <div className="space-y-2">
                  {task.subTasks.map((subTask) => (
                    <div key={subTask.id} className="flex items-center gap-2 text-sm">
                      {subTask.completedAt ? (
                        <CheckCircle2 className="size-4 text-emerald-600" />
                      ) : (
                        <Circle className="size-4 text-muted-foreground" />
                      )}
                      <span
                        className={cn(
                          subTask.completedAt && "text-muted-foreground line-through"
                        )}
                      >
                        {subTask.title}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="space-y-5 border-t border-border bg-background px-6 py-6 md:border-l md:border-t-0">
            <section className="space-y-3">
              <div className="flex items-center gap-2 font-semibold">
                <CalendarClock className="size-4 text-muted-foreground" />
                Datas
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                {startDate ? <p>Início: {startDate}</p> : null}
                {dueDate ? <p>Limite: {dueDate}</p> : null}
                {completedAt ? <p>Concluída: {completedAt}</p> : null}
                {!startDate && !dueDate && !completedAt ? <p>Sem datas.</p> : null}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2 font-semibold">
                <Tag className="size-4 text-muted-foreground" />
                Etiquetas
              </div>
              {task.labels.length ? (
                <div className="flex flex-wrap gap-2">
                  {task.labels.map(({ label }) => (
                    <Badge key={label.id} variant="secondary">
                      {label.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sem etiquetas.</p>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2 font-semibold">
                <Users className="size-4 text-muted-foreground" />
                Membros
              </div>
              {task.assignees.length ? (
                <div className="flex items-center gap-3">
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
                  <div className="min-w-0 text-sm text-muted-foreground">
                    {task.assignees.map(({ user }) => user.name).join(", ")}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sem membros.</p>
              )}
            </section>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CalendarTaskTrigger({ task }: { task: CalendarTask }) {
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
      {task.board || task.column ? (
        <p className="truncate text-[11px] text-muted-foreground">
          {[task.board?.name, task.column?.name].filter(Boolean).join(" / ")}
        </p>
      ) : null}
    </div>
  );
}

export { CalendarTaskDialog };
