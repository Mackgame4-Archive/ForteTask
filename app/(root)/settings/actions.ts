"use server";

import { redirect } from "next/navigation";

import {
  revokeOtherCurrentUserSessions,
  updateCurrentSessionActiveTenant,
} from "@/lib/auth/session";
import { verifySession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  assignTeamUserSchema,
  assignTenantUserSchema,
  deleteTeamSchema,
  deleteTenantSchema,
  permanentlyDeleteTeamSchema,
  permanentlyDeleteTenantSchema,
  profileSchema,
  recoverTeamSchema,
  recoverTenantSchema,
  teamSchema,
  tenantSchema,
} from "@/schemas/settings";

function canManageOrganizations(role?: string) {
  return role === "admin" || role === "manager";
}

function canAssignUsers(role?: string) {
  return role === "admin";
}

function settingsRedirect(message: string, type: "error" | "saved" = "saved"): never {
  const params = new URLSearchParams({ [type]: message });
  redirect(`/settings?${params.toString()}`);
}

function profileRedirect(message: string, type: "error" | "saved" = "saved"): never {
  const params = new URLSearchParams({ [type]: message });
  redirect(`/settings/profile?${params.toString()}`);
}

export async function createTenantAction(formData: FormData) {
  const session = await verifySession();

  if (!canManageOrganizations(session.role)) {
    settingsRedirect("Não tem permissão para criar organizações.", "error");
  }

  const parsed = tenantSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    settingsRedirect("Introduza um nome de organização válido.", "error");
  }

  try {
    await db.tenant.create({
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
      },
    });
  } catch {
    settingsRedirect("Não foi possível criar a organização. O identificador pode já existir.", "error");
  }

  settingsRedirect("Organização criada.");
}

export async function createTeamAction(formData: FormData) {
  const session = await verifySession();

  if (!canManageOrganizations(session.role)) {
    settingsRedirect("Não tem permissão para criar equipas.", "error");
  }

  const parsed = teamSchema.safeParse({
    tenantId: formData.get("tenantId"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    settingsRedirect("Escolha uma organização e introduza um nome de equipa válido.", "error");
  }

  const tenant = await db.tenant.findUnique({
    where: {
      id: parsed.data.tenantId,
    },
    select: {
      deletedAt: true,
    },
  });

  if (!tenant || tenant.deletedAt) {
    settingsRedirect("A organização não foi encontrada.", "error");
  }

  try {
    await db.team.create({
      data: {
        tenantId: parsed.data.tenantId,
        name: parsed.data.name,
        slug: parsed.data.slug,
      },
    });
  } catch {
    settingsRedirect("Não foi possível criar a equipa. O identificador pode já existir para essa organização.", "error");
  }

  settingsRedirect("Equipa criada.");
}

export async function deleteTeamAction(formData: FormData) {
  const session = await verifySession();

  if (!canAssignUsers(session.role)) {
    settingsRedirect("Não tem permissão para eliminar equipas.", "error");
  }

  const parsed = deleteTeamSchema.safeParse({
    teamId: formData.get("teamId"),
  });

  if (!parsed.success) {
    settingsRedirect("Escolha uma equipa para eliminar.", "error");
  }

  try {
    await db.team.update({
      where: {
        id: parsed.data.teamId,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  } catch {
    settingsRedirect("Não foi possível eliminar a equipa.", "error");
  }

  settingsRedirect("Equipa movida para os itens eliminados.");
}

export async function assignUserToTenantAction(formData: FormData) {
  const session = await verifySession();

  if (!canAssignUsers(session.role)) {
    settingsRedirect("Não tem permissão para atribuir utilizadores.", "error");
  }

  const parsed = assignTenantUserSchema.safeParse({
    tenantId: formData.get("tenantId"),
    userId: formData.get("userId"),
  });

  if (!parsed.success) {
    settingsRedirect("Escolha uma organização e um utilizador.", "error");
  }

  const tenant = await db.tenant.findUnique({
    where: {
      id: parsed.data.tenantId,
    },
    select: {
      deletedAt: true,
    },
  });

  if (!tenant || tenant.deletedAt) {
    settingsRedirect("A organização não foi encontrada.", "error");
  }

  try {
    await db.tenantUser.upsert({
      where: {
        userId_tenantId: {
          userId: parsed.data.userId,
          tenantId: parsed.data.tenantId,
        },
      },
      update: {},
      create: {
        userId: parsed.data.userId,
        tenantId: parsed.data.tenantId,
      },
    });
  } catch {
    settingsRedirect("Não foi possível atribuir o utilizador à organização.", "error");
  }

  settingsRedirect("Utilizador atribuído à organização.");
}

export async function assignUserToTeamAction(formData: FormData) {
  const session = await verifySession();

  if (!canAssignUsers(session.role)) {
    settingsRedirect("Não tem permissão para atribuir utilizadores.", "error");
  }

  const parsed = assignTeamUserSchema.safeParse({
    teamId: formData.get("teamId"),
    userId: formData.get("userId"),
  });

  if (!parsed.success) {
    settingsRedirect("Escolha uma equipa e um utilizador.", "error");
  }

  const team = await db.team.findUnique({
    where: {
      id: parsed.data.teamId,
    },
    select: {
      tenantId: true,
      deletedAt: true,
      tenant: {
        select: {
          deletedAt: true,
        },
      },
    },
  });

  if (!team || team.deletedAt || team.tenant.deletedAt) {
    settingsRedirect("A equipa não foi encontrada.", "error");
  }

  try {
    await db.$transaction([
      db.tenantUser.upsert({
        where: {
          userId_tenantId: {
            userId: parsed.data.userId,
            tenantId: team.tenantId,
          },
        },
        update: {},
        create: {
          userId: parsed.data.userId,
          tenantId: team.tenantId,
        },
      }),
      db.teamUser.upsert({
        where: {
          userId_teamId: {
            userId: parsed.data.userId,
            teamId: parsed.data.teamId,
          },
        },
        update: {},
        create: {
          userId: parsed.data.userId,
          teamId: parsed.data.teamId,
        },
      }),
    ]);
  } catch {
    settingsRedirect("Não foi possível atribuir o utilizador à equipa.", "error");
  }

  settingsRedirect("Utilizador atribuído à equipa.");
}

export async function deleteTenantAction(formData: FormData) {
  const session = await verifySession();

  if (!canAssignUsers(session.role)) {
    settingsRedirect("Não tem permissão para eliminar organizações.", "error");
  }

  const parsed = deleteTenantSchema.safeParse({
    tenantId: formData.get("tenantId"),
  });

  if (!parsed.success) {
    settingsRedirect("Escolha uma organização para eliminar.", "error");
  }

  try {
    await db.tenant.update({
      where: {
        id: parsed.data.tenantId,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    if (session.activeTenantId === parsed.data.tenantId) {
      await updateCurrentSessionActiveTenant(null);
    }
  } catch {
    settingsRedirect("Não foi possível eliminar a organização.", "error");
  }

  settingsRedirect("Organização movida para os itens eliminados.");
}

export async function recoverTenantAction(formData: FormData) {
  const session = await verifySession();

  if (!canAssignUsers(session.role)) {
    settingsRedirect("Não tem permissão para recuperar organizações.", "error");
  }

  const parsed = recoverTenantSchema.safeParse({
    tenantId: formData.get("tenantId"),
  });

  if (!parsed.success) {
    settingsRedirect("Escolha uma organização para recuperar.", "error");
  }

  try {
    await db.tenant.update({
      where: {
        id: parsed.data.tenantId,
      },
      data: {
        deletedAt: null,
      },
    });
  } catch {
    settingsRedirect("Não foi possível recuperar a organização.", "error");
  }

  settingsRedirect("Organização recuperada.");
}

export async function recoverTeamAction(formData: FormData) {
  const session = await verifySession();

  if (!canAssignUsers(session.role)) {
    settingsRedirect("Não tem permissão para recuperar equipas.", "error");
  }

  const parsed = recoverTeamSchema.safeParse({
    teamId: formData.get("teamId"),
  });

  if (!parsed.success) {
    settingsRedirect("Escolha uma equipa para recuperar.", "error");
  }

  const team = await db.team.findUnique({
    where: {
      id: parsed.data.teamId,
    },
    select: {
      tenant: {
        select: {
          deletedAt: true,
        },
      },
    },
  });

  if (!team) {
    settingsRedirect("A equipa não foi encontrada.", "error");
  }

  if (team.tenant.deletedAt) {
    settingsRedirect("Recupere a organização antes de recuperar esta equipa.", "error");
  }

  try {
    await db.team.update({
      where: {
        id: parsed.data.teamId,
      },
      data: {
        deletedAt: null,
      },
    });
  } catch {
    settingsRedirect("Não foi possível recuperar a equipa.", "error");
  }

  settingsRedirect("Equipa recuperada.");
}

export async function permanentlyDeleteTenantAction(formData: FormData) {
  const session = await verifySession();

  if (!canAssignUsers(session.role)) {
    settingsRedirect("Não tem permissão para eliminar organizações permanentemente.", "error");
  }

  const parsed = permanentlyDeleteTenantSchema.safeParse({
    tenantId: formData.get("tenantId"),
  });

  if (!parsed.success) {
    settingsRedirect("Escolha uma organização para eliminar permanentemente.", "error");
  }

  const tenant = await db.tenant.findUnique({
    where: {
      id: parsed.data.tenantId,
    },
    select: {
      id: true,
      deletedAt: true,
    },
  });

  if (!tenant?.deletedAt) {
    settingsRedirect("Mova a organização para os itens eliminados antes de a eliminar permanentemente.", "error");
  }

  try {
    await db.$transaction([
      db.teamUser.deleteMany({
        where: {
          team: {
            tenantId: tenant.id,
          },
        },
      }),
      db.board.deleteMany({
        where: {
          tenantId: tenant.id,
        },
      }),
      db.team.deleteMany({
        where: {
          tenantId: tenant.id,
        },
      }),
      db.tenantUser.deleteMany({
        where: {
          tenantId: tenant.id,
        },
      }),
      db.tenant.delete({
        where: {
          id: tenant.id,
        },
      }),
    ]);
  } catch {
    settingsRedirect("Não foi possível eliminar a organização permanentemente.", "error");
  }

  settingsRedirect("Organização eliminada permanentemente.");
}

export async function permanentlyDeleteTeamAction(formData: FormData) {
  const session = await verifySession();

  if (!canAssignUsers(session.role)) {
    settingsRedirect("Não tem permissão para eliminar equipas permanentemente.", "error");
  }

  const parsed = permanentlyDeleteTeamSchema.safeParse({
    teamId: formData.get("teamId"),
  });

  if (!parsed.success) {
    settingsRedirect("Escolha uma equipa para eliminar permanentemente.", "error");
  }

  const team = await db.team.findUnique({
    where: {
      id: parsed.data.teamId,
    },
    select: {
      id: true,
      deletedAt: true,
    },
  });

  if (!team?.deletedAt) {
    settingsRedirect("Mova a equipa para os itens eliminados antes de a eliminar permanentemente.", "error");
  }

  try {
    await db.$transaction([
      db.teamUser.deleteMany({
        where: {
          teamId: team.id,
        },
      }),
      db.boardTeam.deleteMany({
        where: {
          teamId: team.id,
        },
      }),
      db.team.delete({
        where: {
          id: team.id,
        },
      }),
    ]);
  } catch {
    settingsRedirect("Não foi possível eliminar a equipa permanentemente.", "error");
  }

  settingsRedirect("Equipa eliminada permanentemente.");
}

export async function updateProfileAction(formData: FormData) {
  const session = await verifySession();
  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    currentPassword: formData.get("currentPassword") || undefined,
    newPassword: formData.get("newPassword") || undefined,
  });

  if (!parsed.success) {
    profileRedirect("Verifique os campos do perfil e tente novamente.", "error");
  }

  const user = await db.user.findUnique({
    where: {
      id: session.userId,
    },
  });

  if (!user) {
    profileRedirect("A sua conta de utilizador não foi encontrada.", "error");
  }

  if (parsed.data.email !== user.email) {
    const existingUser = await db.user.findUnique({
      where: {
        email: parsed.data.email,
      },
      select: {
        id: true,
      },
    });

    if (existingUser && existingUser.id !== user.id) {
      profileRedirect("Esse email já está em uso.", "error");
    }
  }

  let passwordHash = user.passwordHash;

  if (parsed.data.newPassword) {
    const isCurrentPasswordValid = await verifyPassword(
      parsed.data.currentPassword ?? "",
      user.passwordHash
    );

    if (!isCurrentPasswordValid) {
      profileRedirect("A palavra-passe atual está incorreta.", "error");
    }

    passwordHash = await hashPassword(parsed.data.newPassword);
  }

  await db.user.update({
    where: {
      id: user.id,
    },
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
    },
  });

  if (parsed.data.newPassword) {
    await revokeOtherCurrentUserSessions(user.id);
  }

  profileRedirect("Perfil atualizado.");
}
