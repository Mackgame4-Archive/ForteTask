import { CalendarDays } from "lucide-react";

import { PageBase } from "@/components/pages/page-base";
import { CalendarTaskCalendar } from "@/components/pages/calendar/calendar-task-calendar";
import { CalendarTaskTable } from "@/components/pages/calendar/calendar-task-table";
import { CalendarTaskTimeline } from "@/components/pages/calendar/calendar-task-timeline";
import {
  CalendarViewSelect,
  type CalendarView,
} from "@/components/pages/calendar/calendar-view-select";
import { getCalendarPageData } from "@/services/tasks";

type CalendarPageProps = {
  searchParams?: Promise<{
    view?: string;
  }>;
};

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const pageParams = await (searchParams ?? Promise.resolve({} as { view?: string }));
  const { canManage, tenant, tasks } = await getCalendarPageData();
  const view: CalendarView =
    pageParams.view === "timeline"
      ? "timeline"
      : pageParams.view === "table"
        ? "table"
        : "calendar";

  return (
    <PageBase
      icon={CalendarDays}
      label="Calendario"
      title="Calendario de tarefas"
      description={
        tenant
          ? `As suas tarefas agendadas para ${tenant.name}.`
          : "Selecione uma organização na barra lateral para ver as suas tarefas agendadas."
      }
      action={<CalendarViewSelect value={view} />}
    >

        {view === "timeline" ? (
          <CalendarTaskTimeline groupByMember={canManage} tasks={tasks} />
        ) : view === "table" ? (
          <CalendarTaskTable tasks={tasks} />
        ) : (
          <CalendarTaskCalendar tasks={tasks} />
        )}
    </PageBase>
  );
}
