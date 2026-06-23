import "server-only";

import { UserRole } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

export type TenantOption = {
  tenant: {
    id: number;
    name: string;
    slug: string;
  };
};

export async function getTenantOptionsForUser(userId: number, role?: string) {
  if (role?.toUpperCase() === UserRole.ADMIN || role?.toUpperCase() === UserRole.MANAGER) {
    const tenants = await db.tenant.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    return tenants.map((tenant) => ({ tenant }));
  }

  return db.tenantUser.findMany({
    where: {
      userId,
      tenant: {
        deletedAt: null,
      },
    },
    orderBy: {
      tenant: {
        name: "asc",
      },
    },
    select: {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });
}
