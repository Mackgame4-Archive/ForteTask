import "server-only";

import { verifySession } from "@/lib/auth/session";
import { db } from "@/lib/db";

function canManageTasks(role?: string) {
  return role === "admin" || role === "manager";
}

export type CalendarTask = {
  id: number;
  title: string;
  description: string | null;
  completed: boolean;
  completedAt: string | null;
  startDate: string | null;
  dueDate: string | null;
  column: {
    id: number;
    name: string;
    color: string;
  } | null;
  board: {
    id: number;
    name: string;
  } | null;
  labels: {
    label: {
      id: number;
      name: string;
    };
  }[];
  assignees: {
    user: {
      id: number;
      name: string;
      email: string;
    };
  }[];
  subTasks: {
    id: number;
    title: string;
    completedAt: string | null;
  }[];
};

export async function getCalendarPageData() {
  const session = await verifySession();
  const membership = session.activeTenantId
    ? await db.tenantUser.findUnique({
        where: {
          userId_tenantId: {
            userId: session.userId,
            tenantId: session.activeTenantId,
          },
        },
        select: {
          tenantId: true,
          tenant: {
            select: {
              id: true,
              name: true,
              deletedAt: true,
            },
          },
        },
      })
    : null;
  const tenant = membership?.tenant.deletedAt ? null : membership?.tenant ?? null;

  if (!tenant || !membership) {
    if (canManageTasks(session.role)) {
      const tasks = await getScheduledTasks();

      return {
        canManage: true,
        tenant,
        tasks,
      };
    }

    return {
      canManage: false,
      tenant,
      tasks: [],
    };
  }

  const canManage = canManageTasks(session.role);
  const tasks = await getScheduledTasks(canManage ? undefined : session.userId);

  return {
    canManage,
    tenant,
    tasks,
  };
}

async function getScheduledTasks(userId?: number) {
  const tasks = await db.task.findMany({
    where: {
      OR: [{ startDate: { not: null } }, { dueDate: { not: null } }],
      ...(userId
        ? {
            column: {
              board: {
                teams: {
                  some: {
                    team: {
                      deletedAt: null,
                      users: {
                        some: {
                          userId,
                        },
                      },
                    },
                  },
                },
              },
            },
          }
        : {}),
    },
    orderBy: [{ dueDate: "asc" }, { startDate: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      completed: true,
      completedAt: true,
      startDate: true,
      dueDate: true,
      labels: {
        select: {
          label: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      assignees: {
        select: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      subTasks: {
        orderBy: {
          id: "asc",
        },
        select: {
          id: true,
          title: true,
          completedAt: true,
        },
      },
      column: {
        select: {
          id: true,
          name: true,
          color: true,
          board: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    completed: task.completed,
    completedAt: task.completedAt?.toISOString() ?? null,
    startDate: task.startDate?.toISOString() ?? null,
    dueDate: task.dueDate?.toISOString() ?? null,
    labels: task.labels,
    assignees: task.assignees,
    subTasks: task.subTasks.map((subTask) => ({
      id: subTask.id,
      title: subTask.title,
      completedAt: subTask.completedAt?.toISOString() ?? null,
    })),
    column: task.column
      ? {
          id: task.column.id,
          name: task.column.name,
          color: task.column.color,
        }
      : null,
    board: task.column?.board
      ? {
          id: task.column.board.id,
          name: task.column.board.name,
        }
      : null,
  }));
}
