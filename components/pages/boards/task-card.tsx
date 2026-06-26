"use client"

import * as React from "react"
import { useEffect, useState, useTransition } from "react"

import { toggleTaskCompletedAction } from "@/app/(root)/boards/actions"
import { CheckIconSwitch } from "@/components/checkicon-switch"
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatDateInputValue } from "@/lib/utils/date"
import { cn } from "@/lib/utils"

export type TaskCardTask = {
  id: number
  title: string
  description: string | null
  startDate: Date | null
  dueDate: Date | null
  completed: boolean
  completedAt: Date | null
  labels: {
    label: {
      id: number
      name: string
    }
  }[]
  assignees: {
    user: {
      id: number
      name: string
      email: string
    }
  }[]
}

type TaskCardProps = React.ComponentProps<"div"> & {
  boardId: number
  onCompletedChange?: (completed: boolean) => void
  task: TaskCardTask
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

export default function TaskCard({
  boardId,
  className,
  onCompletedChange,
  task,
  ...props
}: TaskCardProps) {
  const [completed, setCompleted] = useState(task.completed)
  const [, startTransition] = useTransition()
  const visibleAssignees = task.assignees.slice(0, 3)
  const remainingAssignees = Math.max(task.assignees.length - visibleAssignees.length, 0)

  useEffect(() => {
    setCompleted(task.completed)
  }, [task.completed])

  function toggleCompleted(nextCompleted: boolean) {
    const previousCompleted = completed

    setCompleted(nextCompleted)
    onCompletedChange?.(nextCompleted)
    startTransition(async () => {
      const formData = new FormData()
      formData.set("boardId", String(boardId))
      formData.set("taskId", String(task.id))
      formData.set("completed", String(nextCompleted))

      const result = await toggleTaskCompletedAction(formData)

      if (result?.error) {
        setCompleted(previousCompleted)
        onCompletedChange?.(previousCompleted)
      }
    })
  }

  return (
    <Card
      size="sm"
      className={cn(
        "cursor-pointer bg-background transition-colors hover:bg-muted/50",
        className
      )}
      {...props}
    >
      <CardHeader>
        {task.labels.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {task.labels.map(({ label }) => (
              <Badge key={label.id} variant="secondary" className="text-xs">
                {label.name}
              </Badge>
            ))}
          </div>
        ) : null}
        <div className="flex min-w-0 items-center gap-2">
          <CheckIconSwitch
            checked={completed}
            label={completed ? "Marcar tarefa como por concluir" : "Marcar tarefa como concluída"}
            onCheckedChange={toggleCompleted}
          />
          <CardTitle className={cn("min-w-0", completed && "text-muted-foreground")}>
            {task.title}
          </CardTitle>
        </div>
        {task.description ? (
          <CardDescription>{task.description}</CardDescription>
        ) : null}
      </CardHeader>
      {task.startDate || task.dueDate || task.completedAt || task.assignees.length ? (
        <CardContent>
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {task.startDate ? (
                <span>Início {formatDateInputValue(task.startDate)}</span>
              ) : null}
              {task.dueDate ? (
                <span>Limite {formatDateInputValue(task.dueDate)}</span>
              ) : null}
              {task.completedAt ? (
                <span>Concluída {formatDateInputValue(task.completedAt)}</span>
              ) : null}
            </div>
            {visibleAssignees.length ? (
              <AvatarGroup className="shrink-0">
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
        </CardContent>
      ) : null}
    </Card>
  )
}
