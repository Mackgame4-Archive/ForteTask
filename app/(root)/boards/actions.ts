"use server";

import { redirect } from "next/navigation";

import { verifySession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  boardSchema,
  createColumnSchema,
  createTaskSchema,
  deleteColumnSchema,
  deleteTaskSchema,
  moveColumnSchema,
  moveTaskSchema,
  toggleTaskCompletedSchema,
  updateBoardSchema,
  updateColumnSchema,
  updateTaskDatesSchema,
  updateTaskSchema,
} from "@/schemas/boards";

function boardsRedirect(message: string, type: "error" | "saved" = "saved"): never {
  const params = new URLSearchParams({ [type]: message });
  redirect(`/boards?${params.toString()}`);
}

function boardTaskRedirectUrl({
  boardId,
  formData,
  message,
  type = "saved",
}: {
  boardId: number;
  formData: FormData;
  message: string;
  type?: "error" | "saved";
}) {
  const fallbackPath = `/boards/${boardId}`;
  const redirectTo = formData.get("redirectTo")?.toString() || fallbackPath;
  const url = new URL(redirectTo, "http://fortetask.local");
  const allowedPath = `/boards/${boardId}`;
  const isBoardPath =
    url.origin === "http://fortetask.local" &&
    (url.pathname === allowedPath || url.pathname.startsWith(`${allowedPath}/`));

  if (!isBoardPath) {
    const params = new URLSearchParams({ [type]: message });

    return `${fallbackPath}?${params.toString()}`;
  }

  url.searchParams.delete("error");
  url.searchParams.delete("saved");
  url.searchParams.set(type, message);

  return `${url.pathname}?${url.searchParams.toString()}`;
}

function canManageBoards(role?: string) {
  return role === "admin" || role === "manager" || role === "coordinator";
}

function startOfDateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function applyDatePart(currentDate: Date | null, targetDate: Date) {
  return new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    currentDate?.getHours() ?? 0,
    currentDate?.getMinutes() ?? 0,
    currentDate?.getSeconds() ?? 0,
    currentDate?.getMilliseconds() ?? 0
  );
}

function parseSubTasks(formData: FormData) {
  const ids = formData.getAll("subTaskId").map((value) => value.toString());
  const titles = formData
    .getAll("subTaskTitle")
    .map((value) => value.toString().trim());
  const completedIds = new Set(
    formData.getAll("completedSubTaskId").map((value) => value.toString())
  );

  return titles
    .map((title, index) => ({
      id: Number(ids[index]),
      title,
      completed: ids[index]
        ? completedIds.has(ids[index])
        : completedIds.has(`new-${index}`),
    }))
    .filter((subTask) => subTask.title.length > 0);
}

function parseBoardCustomFields(formData: FormData) {
  const ids = formData.getAll("customFieldId").map((value) => value.toString());
  const names = formData
    .getAll("customFieldName")
    .map((value) => value.toString().trim());
  const types = formData.getAll("customFieldType").map((value) => value.toString());
  const minValues = formData
    .getAll("customFieldMinValue")
    .map((value) => value.toString().trim());
  const maxValues = formData
    .getAll("customFieldMaxValue")
    .map((value) => value.toString().trim());

  return names
    .map((name, index) => ({
      id: ids[index] ? Number(ids[index]) : undefined,
      name,
      type: types[index],
      minValue: minValues[index] === "" ? undefined : minValues[index],
      maxValue: maxValues[index] === "" ? undefined : maxValues[index],
    }))
    .filter((field) => field.name.length > 0);
}

function parseTaskCustomFieldValues(formData: FormData) {
  const values: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("customFieldValue:")) {
      continue;
    }

    const nextValue = value.toString().trim();
    values[key.slice("customFieldValue:".length)] =
      nextValue === "__empty" ? "" : nextValue;
  }

  return values;
}

async function findBoardAssignableUsers({
  boardId,
  tenantId,
  userIds,
}: {
  boardId: number;
  tenantId: number;
  userIds: number[];
}) {
  if (!userIds.length) {
    return [];
  }

  const assignments = await db.teamUser.findMany({
    where: {
      userId: {
        in: userIds,
      },
      team: {
        tenantId,
        deletedAt: null,
        boards: {
          some: {
            boardId,
          },
        },
      },
    },
    select: {
      userId: true,
    },
    distinct: ["userId"],
  });

  return assignments.map((assignment) => assignment.userId);
}

async function findAccessibleTask({
  boardId,
  taskId,
  tenantId,
  userId,
  role,
}: {
  boardId: number;
  taskId: number;
  tenantId: number;
  userId: number;
  role?: string;
}) {
  const userTeams = await db.teamUser.findMany({
    where: {
      userId,
      team: {
        tenantId,
        deletedAt: null,
      },
    },
    select: {
      teamId: true,
    },
  });
  const userTeamIds = userTeams.map((team) => team.teamId);
  const canManage = canManageBoards(role);

  return db.task.findFirst({
    where: {
      id: taskId,
      column: {
        boardId,
        board: {
          tenantId,
          ...(canManage
            ? {}
            : {
                teams: {
                  some: {
                    teamId: {
                      in: userTeamIds,
                    },
                  },
                },
              }),
        },
      },
    },
    select: {
      id: true,
      columnId: true,
      completed: true,
      completedAt: true,
      dueDate: true,
      position: true,
      startDate: true,
      column: {
        select: {
          boardId: true,
        },
      },
    },
  });
}

async function findAccessibleBoard({
  boardId,
  tenantId,
  userId,
  role,
}: {
  boardId: number;
  tenantId: number;
  userId: number;
  role?: string;
}) {
  const userTeams = await db.teamUser.findMany({
    where: {
      userId,
      team: {
        tenantId,
        deletedAt: null,
      },
    },
    select: {
      teamId: true,
    },
  });
  const userTeamIds = userTeams.map((team) => team.teamId);
  const canManage = canManageBoards(role);

  return db.board.findFirst({
    where: {
      id: boardId,
      tenantId,
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
    select: {
      id: true,
    },
  });
}

export async function createBoardAction(formData: FormData) {
  const session = await verifySession();

  if (!session.activeTenantId) {
    boardsRedirect("Selecione uma organização antes de criar um quadro.", "error");
  }

  const parsed = boardSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    teamIds: formData.getAll("teamIds"),
  });

  if (!parsed.success) {
    boardsRedirect("Introduza um nome de quadro válido e escolha pelo menos uma equipa.", "error");
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
    boardsRedirect("Não tem acesso a esta organização.", "error");
  }

  const teams = parsed.data.teamIds.length
    ? await db.team.findMany({
        where: {
          id: {
            in: parsed.data.teamIds,
          },
          tenantId: membership.tenantId,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      })
    : [];

  if (teams.length !== parsed.data.teamIds.length) {
    boardsRedirect("Escolha equipas válidas para esta organização.", "error");
  }

  try {
    await db.board.create({
      data: {
        tenantId: membership.tenantId,
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description,
        columns: {
          create: [
            { name: "A fazer", slug: "a-fazer", color: "#facc15", position: 0 },
            {
              name: "Em curso",
              slug: "em-curso",
              color: "#3b82f6",
              position: 1,
            },
            { name: "Concluído", slug: "concluido", color: "#22c55e", position: 2 },
          ],
        },
        customFields: {
          create: [
            {
              name: "Prioridade",
              slug: "prioridade",
              type: "INTEGER",
              minValue: 0,
              maxValue: 5,
              position: 0,
            },
            {
              name: "Esforço",
              slug: "esforco",
              type: "INTEGER",
              minValue: 0,
              maxValue: 5,
              position: 1,
            },
          ],
        },
        teams: {
          create: teams.map((team) => ({
            teamId: team.id,
          })),
        },
      },
    });
  } catch {
    boardsRedirect("Não foi possível criar o quadro. Pode já existir um quadro com esse nome.", "error");
  }

  boardsRedirect("Quadro criado.");
}

export async function updateBoardAction(formData: FormData) {
  const session = await verifySession();
  const redirectTo = formData.get("redirectTo")?.toString() || "/boards";

  if (!canManageBoards(session.role)) {
    boardsRedirect("Não tem permissão para editar quadros.", "error");
  }

  if (!session.activeTenantId) {
    boardsRedirect("Selecione uma organização antes de editar um quadro.", "error");
  }

  const parsed = updateBoardSchema.safeParse({
    boardId: formData.get("boardId"),
    name: formData.get("name"),
    teamIds: formData.getAll("teamIds"),
    labels: formData.getAll("labels"),
    customFields: parseBoardCustomFields(formData),
  });

  if (!parsed.success) {
    boardsRedirect("Introduza um nome de quadro válido e escolha pelo menos uma equipa.", "error");
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
    boardsRedirect("Não tem acesso a esta organização.", "error");
  }

  const [board, teams] = await Promise.all([
    db.board.findFirst({
      where: {
        id: parsed.data.boardId,
        tenantId: membership.tenantId,
      },
      select: {
        id: true,
      },
    }),
    db.team.findMany({
      where: {
            id: {
              in: parsed.data.teamIds,
            },
            tenantId: membership.tenantId,
            deletedAt: null,
          },
      select: {
        id: true,
      },
    }),
  ]);

  if (!board) {
    boardsRedirect("O quadro não foi encontrado.", "error");
  }

  if (teams.length !== parsed.data.teamIds.length) {
    boardsRedirect("Escolha equipas válidas para esta organização.", "error");
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.board.update({
        where: {
          id: board.id,
        },
        data: {
          name: parsed.data.name,
          slug: parsed.data.slug,
        },
      });

      await tx.boardTeam.deleteMany({
        where: {
          boardId: board.id,
        },
      });

      await tx.boardTeam.createMany({
        data: teams.map((team) => ({
          boardId: board.id,
          teamId: team.id,
        })),
      });

      await tx.boardLabel.deleteMany({
        where: {
          boardId: board.id,
          name: {
            notIn: parsed.data.labels.length ? parsed.data.labels : ["\0"],
          },
        },
      });

      if (parsed.data.labels.length) {
        await tx.boardLabel.createMany({
          data: parsed.data.labels.map((name) => ({
            boardId: board.id,
            name,
          })),
          skipDuplicates: true,
        });
      }

      const customFieldIds = parsed.data.customFields
        .map((field) => field.id)
        .filter((id): id is number => Boolean(id));

      await tx.boardCustomField.deleteMany({
        where: {
          boardId: board.id,
          id: {
            notIn: customFieldIds.length ? customFieldIds : [0],
          },
        },
      });

      for (const [position, field] of parsed.data.customFields.entries()) {
        const data = {
          name: field.name,
          slug: field.slug,
          type: field.type,
          minValue: field.minValue,
          maxValue: field.maxValue,
          position,
        };

        if (field.id) {
          await tx.boardCustomField.updateMany({
            where: {
              id: field.id,
              boardId: board.id,
            },
            data,
          });
        } else {
          await tx.boardCustomField.create({
            data: {
              ...data,
              boardId: board.id,
            },
          });
        }
      }
    });
  } catch {
    boardsRedirect("Não foi possível atualizar o quadro. Pode já existir um quadro com esse nome.", "error");
  }

  const params = new URLSearchParams({ saved: "Quadro atualizado." });
  redirect(`${redirectTo}?${params.toString()}`);
}

export async function createColumnAction(formData: FormData) {
  const session = await verifySession();

  if (!canManageBoards(session.role)) {
    boardsRedirect("Não tem permissão para adicionar colunas ao quadro.", "error");
  }

  if (!session.activeTenantId) {
    boardsRedirect("Selecione uma organização antes de adicionar uma coluna ao quadro.", "error");
  }

  const parsed = createColumnSchema.safeParse({
    boardId: formData.get("boardId"),
    name: formData.get("name"),
    color: formData.get("color"),
  });

  if (!parsed.success) {
    boardsRedirect("Introduza um nome de coluna válido.", "error");
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
    boardsRedirect("Não tem acesso a esta organização.", "error");
  }

  const board = await db.board.findFirst({
    where: {
      id: parsed.data.boardId,
      tenantId: membership.tenantId,
    },
    select: {
      id: true,
      _count: {
        select: {
          columns: true,
        },
      },
    },
  });

  if (!board) {
    boardsRedirect("O quadro não foi encontrado.", "error");
  }

  try {
    await db.boardColumn.create({
      data: {
        boardId: board.id,
        name: parsed.data.name,
        slug: parsed.data.slug,
        color: parsed.data.color,
        position: board._count.columns,
      },
    });
  } catch {
    const params = new URLSearchParams({
      error: "Não foi possível criar a coluna. Pode já existir uma coluna com esse nome.",
    });
    redirect(`/boards/${board.id}?${params.toString()}`);
  }

  const params = new URLSearchParams({ saved: "Coluna criada." });
  redirect(`/boards/${board.id}?${params.toString()}`);
}

export async function deleteColumnAction(formData: FormData) {
  const session = await verifySession();

  if (!canManageBoards(session.role)) {
    boardsRedirect("Não tem permissão para eliminar colunas do quadro.", "error");
  }

  if (!session.activeTenantId) {
    boardsRedirect("Selecione uma organização antes de eliminar uma coluna do quadro.", "error");
  }

  const parsed = deleteColumnSchema.safeParse({
    boardId: formData.get("boardId"),
    columnId: formData.get("columnId"),
  });

  if (!parsed.success) {
    boardsRedirect("Escolha uma coluna válida.", "error");
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
    boardsRedirect("Não tem acesso a esta organização.", "error");
  }

  const column = await db.boardColumn.findFirst({
    where: {
      id: parsed.data.columnId,
      boardId: parsed.data.boardId,
      board: {
        tenantId: membership.tenantId,
      },
    },
    select: {
      id: true,
      boardId: true,
      position: true,
    },
  });

  if (!column) {
    boardsRedirect("A coluna não foi encontrada.", "error");
  }

  await db.$transaction(async (tx) => {
    await tx.boardColumn.delete({
      where: {
        id: column.id,
      },
    });

    await tx.boardColumn.updateMany({
      where: {
        boardId: column.boardId,
        position: {
          gt: column.position,
        },
      },
      data: {
        position: {
          decrement: 1,
        },
      },
    });
  });

  const params = new URLSearchParams({ saved: "Coluna eliminada." });
  redirect(`/boards/${column.boardId}?${params.toString()}`);
}

export async function updateColumnAction(formData: FormData) {
  const session = await verifySession();

  if (!canManageBoards(session.role)) {
    boardsRedirect("Não tem permissão para editar colunas do quadro.", "error");
  }

  if (!session.activeTenantId) {
    boardsRedirect("Selecione uma organização antes de editar uma coluna do quadro.", "error");
  }

  const parsed = updateColumnSchema.safeParse({
    boardId: formData.get("boardId"),
    columnId: formData.get("columnId"),
    name: formData.get("name"),
    color: formData.get("color"),
  });

  if (!parsed.success) {
    boardsRedirect("Introduza um nome de coluna válido.", "error");
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
    boardsRedirect("Não tem acesso a esta organização.", "error");
  }

  const column = await db.boardColumn.findFirst({
    where: {
      id: parsed.data.columnId,
      boardId: parsed.data.boardId,
      board: {
        tenantId: membership.tenantId,
      },
    },
    select: {
      id: true,
      boardId: true,
    },
  });

  if (!column) {
    boardsRedirect("A coluna não foi encontrada.", "error");
  }

  try {
    await db.boardColumn.update({
      where: {
        id: column.id,
      },
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        color: parsed.data.color,
      },
    });
  } catch {
    const params = new URLSearchParams({
      error: "Não foi possível atualizar a coluna. Pode já existir uma coluna com esse nome.",
    });
    redirect(`/boards/${column.boardId}?${params.toString()}`);
  }

  const params = new URLSearchParams({ saved: "Coluna atualizada." });
  redirect(`/boards/${column.boardId}?${params.toString()}`);
}

export async function createTaskAction(formData: FormData) {
  const session = await verifySession();

  if (!session.activeTenantId) {
    boardsRedirect("Selecione uma organização antes de criar uma tarefa.", "error");
  }

  const parsed = createTaskSchema.safeParse({
    boardId: formData.get("boardId"),
    columnId: formData.get("columnId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    startDate: formData.get("startDate"),
    startTime: formData.get("startTime"),
    dueDate: formData.get("dueDate"),
    dueTime: formData.get("dueTime"),
    labelIds: formData.getAll("labelIds"),
    assigneeIds: formData.getAll("assigneeIds"),
    customFieldValues: parseTaskCustomFieldValues(formData),
  });

  if (!parsed.success) {
    boardsRedirect("Introduza um título de tarefa válido.", "error");
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
    boardsRedirect("Não tem acesso a esta organização.", "error");
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

  const column = await db.boardColumn.findFirst({
    where: {
      id: parsed.data.columnId,
      boardId: parsed.data.boardId,
      board: {
        tenantId: membership.tenantId,
        ...(canManage
          ? {}
          : {
              teams: {
                some: {
                  teamId: {
                    in: userTeamIds,
                  },
                },
              },
            }),
      },
    },
    select: {
      id: true,
      boardId: true,
      _count: {
        select: {
          tasks: true,
        },
      },
    },
  });

  if (!column) {
    boardsRedirect("A coluna não foi encontrada.", "error");
  }

  const [labels, assigneeIds] = await Promise.all([
    parsed.data.labelIds.length
      ? db.boardLabel.findMany({
          where: {
            id: {
              in: parsed.data.labelIds,
            },
            boardId: column.boardId,
          },
          select: {
            id: true,
          },
        })
      : [],
    findBoardAssignableUsers({
      boardId: column.boardId,
      tenantId: membership.tenantId,
      userIds: parsed.data.assigneeIds,
    }),
  ]);

  await db.task.create({
    data: {
      tenantId: membership.tenantId,
      columnId: column.id,
      createdById: session.userId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      startDate: parsed.data.startDate ?? null,
      dueDate: parsed.data.dueDate ?? null,
      position: column._count.tasks,
      ...(labels.length
        ? {
            labels: {
              create: labels.map((label) => ({
                boardLabelId: label.id,
              })),
            },
          }
        : {}),
      ...(assigneeIds.length
        ? {
            assignees: {
              create: assigneeIds.map((userId) => ({
                userId,
              })),
            },
          }
        : {}),
    },
  });

  redirect(
    boardTaskRedirectUrl({
      boardId: column.boardId,
      formData,
      message: "Tarefa criada.",
    })
  );
}

export async function updateTaskAction(formData: FormData) {
  const session = await verifySession();

  if (!session.activeTenantId) {
    boardsRedirect("Selecione uma organização antes de editar uma tarefa.", "error");
  }

  const parsed = updateTaskSchema.safeParse({
    boardId: formData.get("boardId"),
    taskId: formData.get("taskId"),
    columnId: formData.get("columnId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    completed: formData.get("completed"),
    startDate: formData.get("startDate"),
    startTime: formData.get("startTime"),
    dueDate: formData.get("dueDate"),
    dueTime: formData.get("dueTime"),
    labelIds: formData.getAll("labelIds"),
    assigneeIds: formData.getAll("assigneeIds"),
    customFieldValues: parseTaskCustomFieldValues(formData),
  });

  if (!parsed.success) {
    boardsRedirect("Introduza um título de tarefa válido.", "error");
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
    boardsRedirect("Não tem acesso a esta organização.", "error");
  }

  const task = await findAccessibleTask({
    boardId: parsed.data.boardId,
    taskId: parsed.data.taskId,
    tenantId: membership.tenantId,
    userId: session.userId,
    role: session.role,
  });

  if (!task) {
    boardsRedirect("A tarefa não foi encontrada.", "error");
  }

  const taskBoardId = task.column?.boardId ?? parsed.data.boardId;
  const [targetColumn, labels, assigneeIds, currentSubTasks, customFields] = await Promise.all([
    db.boardColumn.findFirst({
      where: {
        id: parsed.data.columnId,
        boardId: taskBoardId,
      },
      select: {
        id: true,
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    }),
    parsed.data.labelIds.length
      ? db.boardLabel.findMany({
          where: {
            id: {
              in: parsed.data.labelIds,
            },
            boardId: taskBoardId,
          },
          select: {
            id: true,
          },
        })
      : [],
    findBoardAssignableUsers({
      boardId: taskBoardId,
      tenantId: membership.tenantId,
      userIds: parsed.data.assigneeIds,
    }),
    db.subTask.findMany({
      where: {
        taskId: task.id,
      },
      select: {
        id: true,
        completedAt: true,
      },
    }),
    db.boardCustomField.findMany({
      where: {
        boardId: taskBoardId,
      },
      select: {
        id: true,
        type: true,
        minValue: true,
        maxValue: true,
      },
    }),
  ]);

  if (!targetColumn) {
    boardsRedirect("Escolha uma coluna válida.", "error");
  }

  const labelIds = labels.map((label) => label.id);
  const subTasks = parseSubTasks(formData);
  const currentSubTaskCompletion = new Map(
    currentSubTasks.map((subTask) => [subTask.id, subTask.completedAt])
  );
  const subTaskIds = subTasks
    .map((subTask) => subTask.id)
    .filter((id) => Number.isInteger(id) && id > 0);
  const customFieldValues: {
    taskId: number;
    customFieldId: number;
    stringValue: string | null;
    integerValue: number | null;
  }[] = [];

  for (const field of customFields) {
    const rawValue = parsed.data.customFieldValues[String(field.id)] ?? "";

    if (!rawValue) {
      continue;
    }

    if (field.type === "STRING") {
      customFieldValues.push({
        taskId: task.id,
        customFieldId: field.id,
        stringValue: rawValue.slice(0, 255),
        integerValue: null,
      });
      continue;
    }

    const integerValue = Number(rawValue);

    if (
      !Number.isInteger(integerValue) ||
      (field.minValue != null && integerValue < field.minValue) ||
      (field.maxValue != null && integerValue > field.maxValue)
    ) {
      boardsRedirect("Escolha um valor válido para os campos personalizados.", "error");
    }

    customFieldValues.push({
      taskId: task.id,
      customFieldId: field.id,
      stringValue: null,
      integerValue,
    });
  }

  await db.$transaction(async (tx) => {
    if (task.columnId !== targetColumn.id) {
      await tx.task.updateMany({
        where: {
          columnId: task.columnId,
          position: {
            gt: task.position,
          },
        },
        data: {
          position: {
            decrement: 1,
          },
        },
      });
    }

    await tx.task.update({
      where: {
        id: task.id,
      },
      data: {
        columnId: targetColumn.id,
        ...(task.columnId !== targetColumn.id
          ? { position: targetColumn._count.tasks }
          : {}),
        title: parsed.data.title,
        description: parsed.data.description || null,
        completed: parsed.data.completed,
        completedAt: parsed.data.completed
          ? task.completedAt ?? new Date()
          : null,
        startDate: parsed.data.startDate ?? null,
        dueDate: parsed.data.dueDate ?? null,
      },
    });

    await tx.taskLabel.deleteMany({
      where: {
        taskId: task.id,
      },
    });

    if (labelIds.length) {
      await tx.taskLabel.createMany({
        data: labelIds.map((labelId) => ({
          taskId: task.id,
          boardLabelId: labelId,
        })),
        skipDuplicates: true,
      });
    }

    await tx.taskAssignee.deleteMany({
      where: {
        taskId: task.id,
      },
    });

    if (assigneeIds.length) {
      await tx.taskAssignee.createMany({
        data: assigneeIds.map((userId) => ({
          taskId: task.id,
          userId,
        })),
        skipDuplicates: true,
      });
    }

    await tx.subTask.deleteMany({
      where: {
        taskId: task.id,
        id: {
          notIn: subTaskIds.length ? subTaskIds : [0],
        },
      },
    });

    for (const subTask of subTasks) {
      if (subTask.id > 0) {
        await tx.subTask.updateMany({
          where: {
            id: subTask.id,
            taskId: task.id,
          },
          data: {
            title: subTask.title,
            completedAt: subTask.completed
              ? currentSubTaskCompletion.get(subTask.id) ?? new Date()
              : null,
          },
        });
      } else {
        await tx.subTask.create({
          data: {
            taskId: task.id,
            title: subTask.title,
            completedAt: subTask.completed ? new Date() : null,
          },
        });
      }
    }

    await tx.taskCustomFieldValue.deleteMany({
      where: {
        taskId: task.id,
        customField: {
          boardId: taskBoardId,
        },
      },
    });

    if (customFieldValues.length) {
      await tx.taskCustomFieldValue.createMany({
        data: customFieldValues,
      });
    }
  });

  redirect(
    boardTaskRedirectUrl({
      boardId: taskBoardId,
      formData,
      message: "Tarefa atualizada.",
    })
  );
}

export async function moveTaskAction(formData: FormData) {
  const session = await verifySession();

  if (!session.activeTenantId) {
    return { error: "Selecione uma organização antes de mover tarefas." };
  }

  const parsed = moveTaskSchema.safeParse({
    boardId: formData.get("boardId"),
    taskId: formData.get("taskId"),
    sourceColumnId: formData.get("sourceColumnId"),
    targetColumnId: formData.get("targetColumnId"),
    sourceTaskIds: formData.getAll("sourceTaskIds"),
    targetTaskIds: formData.getAll("targetTaskIds"),
  });

  if (!parsed.success) {
    return { error: "Não foi possível mover a tarefa." };
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
    return { error: "Não tem acesso a esta organização." };
  }

  const board = await findAccessibleBoard({
    boardId: parsed.data.boardId,
    tenantId: membership.tenantId,
    userId: session.userId,
    role: session.role,
  });

  if (!board) {
    return { error: "O quadro não foi encontrado." };
  }

  const [sourceColumn, targetColumn, task] = await Promise.all([
    db.boardColumn.findFirst({
      where: {
        id: parsed.data.sourceColumnId,
        boardId: board.id,
      },
      select: {
        id: true,
      },
    }),
    db.boardColumn.findFirst({
      where: {
        id: parsed.data.targetColumnId,
        boardId: board.id,
      },
      select: {
        id: true,
      },
    }),
    db.task.findFirst({
      where: {
        id: parsed.data.taskId,
        columnId: parsed.data.sourceColumnId,
        column: {
          boardId: board.id,
        },
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (!sourceColumn || !targetColumn || !task) {
    return { error: "Não foi possível mover a tarefa." };
  }

  const sameColumn = sourceColumn.id === targetColumn.id;
  const targetTaskIds = [...new Set(parsed.data.targetTaskIds)];
  const sourceTaskIds = sameColumn
    ? []
    : [...new Set(parsed.data.sourceTaskIds)].filter((id) => id !== task.id);

  if (!targetTaskIds.includes(task.id)) {
    return { error: "Não foi possível mover a tarefa." };
  }

  const movedTaskIds = [...new Set([...targetTaskIds, ...sourceTaskIds])];
  const movedTasks = movedTaskIds.length
    ? await db.task.findMany({
        where: {
          id: {
            in: movedTaskIds,
          },
          columnId: {
            in: [sourceColumn.id, targetColumn.id],
          },
          column: {
            boardId: board.id,
          },
        },
        select: {
          id: true,
        },
      })
    : [];

  if (movedTasks.length !== movedTaskIds.length) {
    return { error: "Não foi possível mover a tarefa." };
  }

  await db.$transaction(async (tx) => {
    await Promise.all(
      targetTaskIds.map((taskId, position) =>
        tx.task.updateMany({
          where: {
            id: taskId,
            columnId: {
              in: [sourceColumn.id, targetColumn.id],
            },
          },
          data: {
            columnId: targetColumn.id,
            position,
          },
        })
      )
    );

    if (!sameColumn) {
      await Promise.all(
        sourceTaskIds.map((taskId, position) =>
          tx.task.updateMany({
            where: {
              id: taskId,
              columnId: {
                in: [sourceColumn.id, targetColumn.id],
              },
            },
            data: {
              columnId: sourceColumn.id,
              position,
            },
          })
        )
      );
    }
  });

  return { saved: true };
}

export async function updateTaskDatesAction(formData: FormData) {
  const session = await verifySession();

  if (!session.activeTenantId) {
    return { error: "Selecione uma organização antes de editar uma tarefa." };
  }

  const parsed = updateTaskDatesSchema.safeParse({
    boardId: formData.get("boardId"),
    taskId: formData.get("taskId"),
    edge: formData.get("edge"),
    targetDate: formData.get("targetDate"),
  });

  if (!parsed.success || !parsed.data.targetDate) {
    return { error: "Não foi possível atualizar as datas da tarefa." };
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
    return { error: "Não tem acesso a esta organização." };
  }

  const task = await findAccessibleTask({
    boardId: parsed.data.boardId,
    taskId: parsed.data.taskId,
    tenantId: membership.tenantId,
    userId: session.userId,
    role: session.role,
  });

  if (!task) {
    return { error: "A tarefa não foi encontrada." };
  }

  const targetDate = parsed.data.targetDate;

  if (parsed.data.edge === "start") {
    const nextStartDate = applyDatePart(task.startDate, targetDate);

    if (
      task.dueDate &&
      startOfDateOnly(nextStartDate) > startOfDateOnly(task.dueDate)
    ) {
      return { error: "A data de início não pode ficar depois da data limite." };
    }

    await db.task.update({
      where: {
        id: task.id,
      },
      data: {
        startDate: nextStartDate,
      },
    });

    return { saved: true };
  }

  const nextDueDate = applyDatePart(task.dueDate, targetDate);

  if (
    task.startDate &&
    startOfDateOnly(nextDueDate) < startOfDateOnly(task.startDate)
  ) {
    return { error: "A data limite não pode ficar antes da data de início." };
  }

  await db.task.update({
    where: {
      id: task.id,
    },
    data: {
      dueDate: nextDueDate,
    },
  });

  return { saved: true };
}

export async function moveColumnAction(formData: FormData) {
  const session = await verifySession();

  if (!canManageBoards(session.role)) {
    return { error: "Não tem permissão para mover colunas do quadro." };
  }

  if (!session.activeTenantId) {
    return { error: "Selecione uma organização antes de mover colunas." };
  }

  const parsed = moveColumnSchema.safeParse({
    boardId: formData.get("boardId"),
    columnId: formData.get("columnId"),
    columnIds: formData.getAll("columnIds"),
  });

  if (!parsed.success) {
    return { error: "Não foi possível mover a coluna." };
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
    return { error: "Não tem acesso a esta organização." };
  }

  const board = await findAccessibleBoard({
    boardId: parsed.data.boardId,
    tenantId: membership.tenantId,
    userId: session.userId,
    role: session.role,
  });

  if (!board) {
    return { error: "O quadro não foi encontrado." };
  }

  const columnIds = [...new Set(parsed.data.columnIds)];

  if (!columnIds.includes(parsed.data.columnId)) {
    return { error: "Não foi possível mover a coluna." };
  }

  const boardColumns = await db.boardColumn.findMany({
    where: {
      boardId: board.id,
    },
    select: {
      id: true,
    },
  });
  const boardColumnIds = new Set(boardColumns.map((column) => column.id));

  if (
    columnIds.length !== boardColumnIds.size ||
    columnIds.some((columnId) => !boardColumnIds.has(columnId))
  ) {
    return { error: "Não foi possível mover a coluna." };
  }

  await db.$transaction(
    columnIds.map((columnId, position) =>
      db.boardColumn.update({
        where: {
          id: columnId,
        },
        data: {
          position,
        },
      })
    )
  );

  return { saved: true };
}

export async function deleteTaskAction(formData: FormData) {
  const session = await verifySession();

  if (!session.activeTenantId) {
    boardsRedirect("Selecione uma organização antes de eliminar uma tarefa.", "error");
  }

  const parsed = deleteTaskSchema.safeParse({
    boardId: formData.get("boardId"),
    taskId: formData.get("taskId"),
  });

  if (!parsed.success) {
    boardsRedirect("Escolha uma tarefa válida.", "error");
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
    boardsRedirect("Não tem acesso a esta organização.", "error");
  }

  const task = await findAccessibleTask({
    boardId: parsed.data.boardId,
    taskId: parsed.data.taskId,
    tenantId: membership.tenantId,
    userId: session.userId,
    role: session.role,
  });

  if (!task) {
    boardsRedirect("A tarefa não foi encontrada.", "error");
  }

  await db.task.delete({
    where: {
      id: task.id,
    },
  });

  redirect(
    boardTaskRedirectUrl({
      boardId: task.column?.boardId ?? parsed.data.boardId,
      formData,
      message: "Tarefa eliminada.",
    })
  );
}

export async function toggleTaskCompletedAction(formData: FormData) {
  const session = await verifySession();

  if (!session.activeTenantId) {
    return { error: "Selecione uma organização antes de editar uma tarefa." };
  }

  const parsed = toggleTaskCompletedSchema.safeParse({
    boardId: formData.get("boardId"),
    taskId: formData.get("taskId"),
    completed: formData.get("completed"),
  });

  if (!parsed.success) {
    return { error: "Não foi possível atualizar a tarefa." };
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
    return { error: "Não tem acesso a esta organização." };
  }

  const task = await findAccessibleTask({
    boardId: parsed.data.boardId,
    taskId: parsed.data.taskId,
    tenantId: membership.tenantId,
    userId: session.userId,
    role: session.role,
  });

  if (!task) {
    return { error: "A tarefa não foi encontrada." };
  }

  await db.task.update({
    where: {
      id: task.id,
    },
    data: {
      completed: parsed.data.completed,
      completedAt: parsed.data.completed
        ? task.completedAt ?? new Date()
        : null,
    },
  });

  return { saved: true, completed: parsed.data.completed };
}
