import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { hashPassword } from "../lib/auth/crypto";
import { PrismaClient } from "../generated/prisma/client";
import { UserRole } from "../generated/prisma/enums";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const rootEmail = process.env.ROOT_USER_EMAIL;
const rootPassword = process.env.ROOT_USER_PASSWORD;
const rootName = process.env.ROOT_USER_NAME ?? "Root";

if (!rootEmail || !rootPassword) {
  throw new Error("ROOT_USER_EMAIL and ROOT_USER_PASSWORD are required to seed the root user.");
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const db = new PrismaClient({
  adapter,
});

try {
  const passwordHash = await hashPassword(rootPassword);

  await db.user.upsert({
    where: {
      email: rootEmail.toLowerCase(),
    },
    update: {
      name: rootName,
      passwordHash,
      role: UserRole.ADMIN,
    },
    create: {
      name: rootName,
      email: rootEmail.toLowerCase(),
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  console.log(`Seeded root admin: ${rootEmail.toLowerCase()}`);
} finally {
  await db.$disconnect();
}
