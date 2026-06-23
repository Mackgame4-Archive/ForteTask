"use client";

import { TaskCalendar } from "@/components/task-calendar";
import { CalendarTaskDialog } from "@/components/pages/calendar/calendar-task-dialog";
import type { CalendarTask } from "@/services/tasks";

type CalendarTaskCalendarProps = {
  tasks: CalendarTask[];
};

function CalendarTaskCalendar({ tasks }: CalendarTaskCalendarProps) {
  const calendarItems = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    completed: task.completed,
    startDate: task.startDate,
    dueDate: task.dueDate,
    color: task.column?.color,
    description: [task.board?.name, task.column?.name].filter(Boolean).join(" / "),
    task,
  }));

  return (
    <TaskCalendar
      items={calendarItems}
      summary={`${tasks.length} ${
        tasks.length === 1 ? "tarefa agendada" : "tarefas agendadas"
      }`}
      renderItem={(item) => <CalendarTaskDialog task={item.task} />}
    />
  );
}

export { CalendarTaskCalendar };
