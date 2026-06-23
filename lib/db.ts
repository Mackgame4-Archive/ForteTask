import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { DatabaseConnectionError } from "@/lib/utils/errors";

const databaseUrl = process.env.DATABASE_URL;

function createMissingDatabaseUrlClient() {
  return new Proxy(
    {},
    {
      get() {
        throw new DatabaseConnectionError();
      },
    }
  ) as PrismaClient;
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const db =
  globalForPrisma.prisma ??
  (databaseUrl
    ? new PrismaClient({
        adapter: new PrismaPg({
          connectionString: databaseUrl,
        }),
      })
    : createMissingDatabaseUrlClient());

if (process.env.NODE_ENV !== "production" && databaseUrl) {
  globalForPrisma.prisma = db;
}
