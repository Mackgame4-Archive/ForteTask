import "server-only";

import { UserRole } from "@/generated/prisma/enums";
import { verifySession } from "@/lib/auth/session";
import { db } from "@/lib/db";

function canChatWithAllUsers(role?: string) {
  return role?.toUpperCase() === UserRole.ADMIN || role?.toUpperCase() === UserRole.MANAGER;
}

async function getChatPageData() {
  const session = await verifySession();
  const members =
    canChatWithAllUsers(session.role) || !session.activeTenantId
      ? await db.user.findMany({
          where: {
            id: {
              not: session.userId,
            },
          },
          orderBy: {
            name: "asc",
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        })
      : await db.user.findMany({
          where: {
            OR: [
              {
                tenants: {
                  some: {
                    tenantId: session.activeTenantId,
                    tenant: {
                      deletedAt: null,
                    },
                  },
                },
              },
              {
                role: {
                  in: [UserRole.ADMIN, UserRole.MANAGER],
                },
              },
            ],
            id: {
              not: session.userId,
            },
          },
          orderBy: {
            name: "asc",
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        });

  return {
    members: members.map((member) => ("user" in member ? member.user : member)),
    session,
  };
}

export { getChatPageData };
export type ChatMember = Awaited<ReturnType<typeof getChatPageData>>["members"][number];
