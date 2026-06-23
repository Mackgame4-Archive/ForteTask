"use server";

import { redirect } from "next/navigation";

import { UserRole } from "@/generated/prisma/enums";
import { updateCurrentSessionActiveTenant, verifySession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  updateMemberSchema,
  updateMemberTeamsSchema,
  updateMemberTenantsSchema,
  updateMembersSchema,
  updateUserRoleSchema,
} from "@/schemas/users";

function canManageMembers(role?: string) {
  return role?.toUpperCase() === UserRole.ADMIN;
}

function membersRedirect(
  message: string,
  type: "error" | "saved" = "saved"
): never {
  const params = new URLSearchParams({ [type]: message });
  redirect(`/members?${params.toString()}`);
}

export async function updateMemberRoleAction(formData: FormData) {
  const session = await verifySession();

  if (!canManageMembers(session.role)) {
    membersRedirect("Não tem permissão para alterar perfis de utilizador.", "error");
  }

  const parsed = updateUserRoleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    membersRedirect("Escolha um membro e um perfil válido.", "error");
  }

  const member = await db.user.findUnique({
    where: {
      id: parsed.data.userId,
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!member) {
    membersRedirect("O membro selecionado não foi encontrado.", "error");
  }

  if (member.role === UserRole.ADMIN && parsed.data.role !== UserRole.ADMIN) {
    const adminCount = await db.user.count({
      where: {
        role: UserRole.ADMIN,
      },
    });

    if (adminCount <= 1) {
      membersRedirect("Não pode remover o último administrador.", "error");
    }
  }

  try {
    await db.user.update({
      where: {
        id: parsed.data.userId,
      },
      data: {
        role: parsed.data.role,
      },
    });
  } catch {
    membersRedirect("Não foi possível atualizar o perfil do membro.", "error");
  }

  membersRedirect("Perfil do membro atualizado.");
}

export async function updateMemberAction(formData: FormData) {
  const session = await verifySession();

  if (!canManageMembers(session.role)) {
    membersRedirect("Não tem permissão para alterar membros.", "error");
  }

  const parsed = updateMemberSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    tenantIds: formData.getAll("tenantIds"),
    teamIds: formData.getAll("teamIds"),
  });

  if (!parsed.success) {
    membersRedirect("Verifique o membro, perfil, organizações e equipas.", "error");
  }

  const member = await db.user.findUnique({
    where: {
      id: parsed.data.userId,
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!member) {
    membersRedirect("O membro selecionado não foi encontrado.", "error");
  }

  if (member.role === UserRole.ADMIN && parsed.data.role !== UserRole.ADMIN) {
    const adminCount = await db.user.count({
      where: {
        role: UserRole.ADMIN,
      },
    });

    if (adminCount <= 1) {
      membersRedirect("Não pode remover o último administrador.", "error");
    }
  }

  const [validTenants, validTeams] = await Promise.all([
    db.tenant.findMany({
      where: {
        id: {
          in: parsed.data.tenantIds,
        },
        deletedAt: null,
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
        deletedAt: null,
        tenant: {
          deletedAt: null,
        },
      },
      select: {
        id: true,
        tenantId: true,
      },
    }),
  ]);

  if (validTenants.length !== parsed.data.tenantIds.length) {
    membersRedirect("Uma das organizações selecionadas não foi encontrada.", "error");
  }

  if (validTeams.length !== parsed.data.teamIds.length) {
    membersRedirect("Uma das equipas selecionadas não foi encontrada.", "error");
  }

  const finalTenantIds = Array.from(
    new Set([
      ...parsed.data.tenantIds,
      ...validTeams.map((team) => team.tenantId),
    ])
  );
  const finalTenantIdSet = new Set(finalTenantIds);

  try {
    await db.$transaction([
      db.user.update({
        where: {
          id: parsed.data.userId,
        },
        data: {
          role: parsed.data.role,
        },
      }),
      db.teamUser.deleteMany({
        where: {
          userId: parsed.data.userId,
          teamId: {
            notIn: parsed.data.teamIds,
          },
        },
      }),
      db.tenantUser.deleteMany({
        where: {
          userId: parsed.data.userId,
          tenantId: {
            notIn: finalTenantIds,
          },
        },
      }),
      ...finalTenantIds.map((tenantId) =>
        db.tenantUser.upsert({
          where: {
            userId_tenantId: {
              userId: parsed.data.userId,
              tenantId,
            },
          },
          update: {},
          create: {
            userId: parsed.data.userId,
            tenantId,
          },
        })
      ),
      ...parsed.data.teamIds.map((teamId) =>
        db.teamUser.upsert({
          where: {
            userId_teamId: {
              userId: parsed.data.userId,
              teamId,
            },
          },
          update: {},
          create: {
            userId: parsed.data.userId,
            teamId,
          },
        })
      ),
    ]);

    if (
      session.userId === parsed.data.userId &&
      session.activeTenantId &&
      !finalTenantIdSet.has(session.activeTenantId)
    ) {
      await updateCurrentSessionActiveTenant(null);
    }
  } catch {
    membersRedirect("Não foi possível atualizar o membro.", "error");
  }

  membersRedirect("Membro atualizado.");
}

export async function updateMembersAction(formData: FormData) {
  const session = await verifySession();

  if (!canManageMembers(session.role)) {
    membersRedirect("Não tem permissão para alterar membros.", "error");
  }

  let rawMembers: unknown;

  try {
    rawMembers = JSON.parse(String(formData.get("members") ?? "[]"));
  } catch {
    membersRedirect("Não foi possível ler as alterações dos membros.", "error");
  }

  const parsed = updateMembersSchema.safeParse({
    members: rawMembers,
  });

  if (!parsed.success) {
    membersRedirect("Verifique os membros, perfis, organizações e equipas.", "error");
  }

  const userIds = parsed.data.members.map((member) => member.userId);
  const currentMembers = await db.user.findMany({
    where: {
      id: {
        in: userIds,
      },
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (currentMembers.length !== userIds.length) {
    membersRedirect("Um dos membros selecionados não foi encontrado.", "error");
  }

  const currentRoleByUserId = new Map(
    currentMembers.map((member) => [member.id, member.role])
  );
  const demotedAdmins = parsed.data.members.filter(
    (member) =>
      currentRoleByUserId.get(member.userId) === UserRole.ADMIN &&
      member.role !== UserRole.ADMIN
  ).length;
  const promotedAdmins = parsed.data.members.filter(
    (member) =>
      currentRoleByUserId.get(member.userId) !== UserRole.ADMIN &&
      member.role === UserRole.ADMIN
  ).length;

  if (demotedAdmins > 0) {
    const currentAdminCount = await db.user.count({
      where: {
        role: UserRole.ADMIN,
      },
    });

    if (currentAdminCount - demotedAdmins + promotedAdmins <= 0) {
      membersRedirect("Não pode remover o último administrador.", "error");
    }
  }

  const tenantIds = Array.from(
    new Set(parsed.data.members.flatMap((member) => member.tenantIds))
  );
  const teamIds = Array.from(
    new Set(parsed.data.members.flatMap((member) => member.teamIds))
  );
  const [validTenants, validTeams] = await Promise.all([
    db.tenant.findMany({
      where: {
        id: {
          in: tenantIds,
        },
        deletedAt: null,
      },
      select: {
        id: true,
      },
    }),
    db.team.findMany({
      where: {
        id: {
          in: teamIds,
        },
        deletedAt: null,
        tenant: {
          deletedAt: null,
        },
      },
      select: {
        id: true,
        tenantId: true,
      },
    }),
  ]);

  if (validTenants.length !== tenantIds.length) {
    membersRedirect("Uma das organizações selecionadas não foi encontrada.", "error");
  }

  if (validTeams.length !== teamIds.length) {
    membersRedirect("Uma das equipas selecionadas não foi encontrada.", "error");
  }

  const teamById = new Map(validTeams.map((team) => [team.id, team]));
  const operations = parsed.data.members.flatMap((member) => {
    const finalTenantIds = Array.from(
      new Set([
        ...member.tenantIds,
        ...member.teamIds.map((teamId) => teamById.get(teamId)!.tenantId),
      ])
    );

    return [
      db.user.update({
        where: {
          id: member.userId,
        },
        data: {
          role: member.role,
        },
      }),
      db.teamUser.deleteMany({
        where: {
          userId: member.userId,
          teamId: {
            notIn: member.teamIds,
          },
        },
      }),
      db.tenantUser.deleteMany({
        where: {
          userId: member.userId,
          tenantId: {
            notIn: finalTenantIds,
          },
        },
      }),
      ...finalTenantIds.map((tenantId) =>
        db.tenantUser.upsert({
          where: {
            userId_tenantId: {
              userId: member.userId,
              tenantId,
            },
          },
          update: {},
          create: {
            userId: member.userId,
            tenantId,
          },
        })
      ),
      ...member.teamIds.map((teamId) =>
        db.teamUser.upsert({
          where: {
            userId_teamId: {
              userId: member.userId,
              teamId,
            },
          },
          update: {},
          create: {
            userId: member.userId,
            teamId,
          },
        })
      ),
    ];
  });

  try {
    await db.$transaction(operations);

    const currentUserUpdate = parsed.data.members.find(
      (member) => member.userId === session.userId
    );

    if (currentUserUpdate && session.activeTenantId) {
      const currentUserFinalTenantIds = new Set([
        ...currentUserUpdate.tenantIds,
        ...currentUserUpdate.teamIds.map(
          (teamId) => teamById.get(teamId)!.tenantId
        ),
      ]);

      if (!currentUserFinalTenantIds.has(session.activeTenantId)) {
        await updateCurrentSessionActiveTenant(null);
      }
    }
  } catch {
    membersRedirect("Não foi possível atualizar os membros.", "error");
  }

  membersRedirect("Membros atualizados.");
}

export async function updateMemberTenantsAction(formData: FormData) {
  const session = await verifySession();

  if (!canManageMembers(session.role)) {
    membersRedirect(
      "Não tem permissão para alterar organizações de membros.",
      "error"
    );
  }

  const parsed = updateMemberTenantsSchema.safeParse({
    userId: formData.get("userId"),
    tenantIds: formData.getAll("tenantIds"),
  });

  if (!parsed.success) {
    membersRedirect("Escolha um membro e as organizações.", "error");
  }

  const validTenants = await db.tenant.findMany({
    where: {
      id: {
        in: parsed.data.tenantIds,
      },
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (validTenants.length !== parsed.data.tenantIds.length) {
    membersRedirect("Uma das organizações selecionadas não foi encontrada.", "error");
  }

  const tenantIds = new Set(parsed.data.tenantIds);

  try {
    await db.$transaction([
      db.teamUser.deleteMany({
        where: {
          userId: parsed.data.userId,
          team: {
            tenantId: {
              notIn: parsed.data.tenantIds,
            },
          },
        },
      }),
      db.tenantUser.deleteMany({
        where: {
          userId: parsed.data.userId,
          tenantId: {
            notIn: parsed.data.tenantIds,
          },
        },
      }),
      ...parsed.data.tenantIds.map((tenantId) =>
        db.tenantUser.upsert({
          where: {
            userId_tenantId: {
              userId: parsed.data.userId,
              tenantId,
            },
          },
          update: {},
          create: {
            userId: parsed.data.userId,
            tenantId,
          },
        })
      ),
    ]);

    if (
      session.userId === parsed.data.userId &&
      session.activeTenantId &&
      !tenantIds.has(session.activeTenantId)
    ) {
      await updateCurrentSessionActiveTenant(null);
    }
  } catch {
    membersRedirect("Não foi possível atualizar as organizações do membro.", "error");
  }

  membersRedirect("Organizações do membro atualizadas.");
}

export async function updateMemberTeamsAction(formData: FormData) {
  const session = await verifySession();

  if (!canManageMembers(session.role)) {
    membersRedirect("Não tem permissão para alterar equipas de membros.", "error");
  }

  const parsed = updateMemberTeamsSchema.safeParse({
    userId: formData.get("userId"),
    teamIds: formData.getAll("teamIds"),
  });

  if (!parsed.success) {
    membersRedirect("Escolha um membro e as equipas.", "error");
  }

  const teams = await db.team.findMany({
    where: {
      id: {
        in: parsed.data.teamIds,
      },
      deletedAt: null,
      tenant: {
        deletedAt: null,
      },
    },
    select: {
      id: true,
      tenantId: true,
    },
  });

  if (teams.length !== parsed.data.teamIds.length) {
    membersRedirect("Uma das equipas selecionadas não foi encontrada.", "error");
  }

  const tenantIds = Array.from(new Set(teams.map((team) => team.tenantId)));

  try {
    await db.$transaction([
      db.teamUser.deleteMany({
        where: {
          userId: parsed.data.userId,
          teamId: {
            notIn: parsed.data.teamIds,
          },
        },
      }),
      ...tenantIds.map((tenantId) =>
        db.tenantUser.upsert({
          where: {
            userId_tenantId: {
              userId: parsed.data.userId,
              tenantId,
            },
          },
          update: {},
          create: {
            userId: parsed.data.userId,
            tenantId,
          },
        })
      ),
      ...parsed.data.teamIds.map((teamId) =>
        db.teamUser.upsert({
          where: {
            userId_teamId: {
              userId: parsed.data.userId,
              teamId,
            },
          },
          update: {},
          create: {
            userId: parsed.data.userId,
            teamId,
          },
        })
      ),
    ]);
  } catch {
    membersRedirect("Não foi possível atualizar as equipas do membro.", "error");
  }

  membersRedirect("Equipas do membro atualizadas.");
}
