import "server-only";

import { verifySession } from "@/lib/auth/session";
import { db } from "@/lib/db";

function canManageBoards(role?: string) {
  return role === "admin" || role === "manager" || role === "coordinator";
}

export async function getBoardsPageData() {
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
  const canCreate = canManageBoards(session.role);

  if (!tenant) {
    return {
      session,
      tenant,
      canCreate,
      teams: [],
      boards: [],
    };
  }

  const userTeams = await db.teamUser.findMany({
    where: {
      userId: session.userId,
      team: {
        tenantId: tenant.id,
        deletedAt: null,
      },
    },
    select: {
      teamId: true,
    },
  });
  const userTeamIds = userTeams.map((membership) => membership.teamId);
  const [teams, boards] = await Promise.all([
    db.team.findMany({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
    db.board.findMany({
      where: {
        tenantId: tenant.id,
        teams: {
          some: {
            team: {
              deletedAt: null,
            },
          },
        },
        ...(canCreate
          ? {}
          : {
              teams: {
                some: {
                  teamId: {
                    in: userTeamIds,
                  },
                  team: {
                    deletedAt: null,
                  },
                },
              },
            }),
      },
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        teams: {
          where: {
            team: {
              deletedAt: null,
            },
          },
          include: {
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            team: {
              name: "asc",
            },
          },
        },
        columns: {
          orderBy: {
            position: "asc",
          },
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                tasks: true,
              },
            },
          },
        },
        _count: {
          select: {
            columns: true,
          },
        },
      },
    }),
  ]);

  return {
    session,
    tenant,
    canCreate,
    teams,
    boards,
  };
}

export async function getBoardPageData(boardId: string) {
  const session = await verifySession();
  const id = Number(boardId);

  if (!Number.isInteger(id) || id <= 0 || !session.activeTenantId) {
    return null;
  }

  const membership = await db.tenantUser.findUnique({
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
          deletedAt: true,
        },
      },
    },
  });

  if (!membership || membership.tenant.deletedAt) {
    return null;
  }

  const userTeams = await db.teamUser.findMany({
    where: {
      userId: session.userId,
      team: {
        tenantId: membership.tenantId,
        deletedAt: null,
      },
    },
    select: {
      teamId: true,
    },
  });
  const userTeamIds = userTeams.map((team) => team.teamId);
  const canManage = canManageBoards(session.role);
  const [teams, board, boardMemberAssignments] = await Promise.all([
    db.team.findMany({
      where: {
        tenantId: membership.tenantId,
        deletedAt: null,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
    db.board.findFirst({
      where: {
        id,
        tenantId: membership.tenantId,
        teams: {
          some: {
            team: {
              deletedAt: null,
            },
          },
        },
        ...(canManage
          ? {}
          : {
              teams: {
                some: {
                  teamId: {
                    in: userTeamIds,
                  },
                  team: {
                    deletedAt: null,
                  },
                },
              },
            }),
      },
      include: {
        teams: {
          where: {
            team: {
              deletedAt: null,
            },
          },
          include: {
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            team: {
              name: "asc",
            },
          },
        },
        labels: {
          orderBy: {
            name: "asc",
          },
          select: {
            id: true,
            name: true,
          },
        },
        customFields: {
          orderBy: {
            position: "asc",
          },
          select: {
            id: true,
            name: true,
            type: true,
            minValue: true,
            maxValue: true,
          },
        },
        columns: {
          orderBy: {
            position: "asc",
          },
          include: {
            tasks: {
              orderBy: {
                position: "asc",
              },
              include: {
                labels: {
                  include: {
                    label: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                  orderBy: {
                    label: {
                      name: "asc",
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
                assignees: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                      },
                    },
                  },
                  orderBy: {
                    user: {
                      name: "asc",
                    },
                  },
                },
                customFieldValues: {
                  select: {
                    customFieldId: true,
                    stringValue: true,
                    integerValue: true,
                  },
                },
                attachments: {
                  orderBy: {
                    createdAt: "desc",
                  },
                  select: {
                    id: true,
                    fileName: true,
                    contentType: true,
                    size: true,
                    createdAt: true,
                    uploadedBy: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
                comments: {
                  orderBy: {
                    createdAt: "desc",
                  },
                  select: {
                    id: true,
                    body: true,
                    createdAt: true,
                    updatedAt: true,
                    author: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                      },
                    },
                  },
                },
                activities: {
                  orderBy: {
                    createdAt: "desc",
                  },
                  select: {
                    id: true,
                    type: true,
                    message: true,
                    createdAt: true,
                    actor: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.teamUser.findMany({
      where: {
        team: {
          tenantId: membership.tenantId,
          deletedAt: null,
          boards: {
            some: {
              boardId: id,
            },
          },
        },
      },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      distinct: ["userId"],
    }),
  ]);

  if (!board) {
    return null;
  }

  // Tasks are nested under their column, so columnId is always the parent
  // column's id. Prisma types it as nullable (Int?), so normalize it here to
  // satisfy the non-null columnId expected by the board view components.
  const normalizedBoard = {
    ...board,
    columns: board.columns.map((column) => ({
      ...column,
      tasks: column.tasks.map((task) => ({
        ...task,
        columnId: column.id,
      })),
    })),
  };

  return {
    session,
    canManage,
    teams,
    boardMembers: boardMemberAssignments
      .map((assignment) => assignment.user)
      .sort((first, second) =>
        first.name.localeCompare(second.name, undefined, {
          sensitivity: "base",
        })
      ),
    board: normalizedBoard,
    totalTasks: normalizedBoard.columns.reduce(
      (count, column) => count + column.tasks.length,
      0
    ),
  };
}
