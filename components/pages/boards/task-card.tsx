import * as React from "react"

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

export default function TaskCard({ className, task, ...props }: TaskCardProps) {
  const visibleAssignees = task.assignees.slice(0, 3)
  const remainingAssignees = Math.max(task.assignees.length - visibleAssignees.length, 0)

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
        <CardTitle>{task.title}</CardTitle>
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
