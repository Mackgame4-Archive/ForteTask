import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { db } from "@/lib/db";

const PASSWORD_RESET_TOKEN_BYTES = 32;
const PASSWORD_RESET_TOKEN_DURATION_MS = 30 * 60 * 1000;

function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createPasswordResetTokenValue() {
  return randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString("base64url");
}

export async function createPasswordResetToken(userId: number) {
  const token = createPasswordResetTokenValue();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_DURATION_MS);

  await db.passwordResetToken.create({
    data: {
      id: hashPasswordResetToken(token),
      userId,
      expiresAt,
    },
  });

  return { expiresAt, token };
}

export async function findValidPasswordResetToken(token: string) {
  if (!token) {
    return null;
  }

  const passwordResetToken = await db.passwordResetToken.findUnique({
    where: {
      id: hashPasswordResetToken(token),
    },
    select: {
      expiresAt: true,
      id: true,
      usedAt: true,
      userId: true,
    },
  });

  if (
    !passwordResetToken ||
    passwordResetToken.usedAt ||
    passwordResetToken.expiresAt <= new Date()
  ) {
    return null;
  }

  return passwordResetToken;
}
