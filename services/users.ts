import "server-only";

import { db } from "@/lib/db";

export async function getUsersPageData() {
  const [members, tenants, teams] = await Promise.all([
    db.user.findMany({
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      tenants: {
        select: {
          tenant: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          tenant: {
            name: "asc",
          },
        },
      },
      teams: {
        select: {
          team: {
            select: {
              id: true,
              tenantId: true,
              name: true,
              tenant: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          team: {
            name: "asc",
          },
        },
      },
    },
  }),
    db.tenant.findMany({
      where: {
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
    db.team.findMany({
      where: {
        deletedAt: null,
        tenant: {
          deletedAt: null,
        },
      },
      orderBy: [
        {
          tenant: {
            name: "asc",
          },
        },
        {
          name: "asc",
        },
      ],
      select: {
        id: true,
        tenantId: true,
        name: true,
        tenant: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  return { members, tenants, teams };
}

export type UsersPageData = Awaited<ReturnType<typeof getUsersPageData>>;
export type UserRow = UsersPageData["members"][number];
export type TenantOption = UsersPageData["tenants"][number];
export type TeamOption = UsersPageData["teams"][number];
