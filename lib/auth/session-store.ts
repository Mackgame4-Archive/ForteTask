import { db } from "@/lib/db";
import { hashSessionToken, SESSION_DURATION_MS } from "@/lib/auth/session-cookie";

export type SessionPayload = {
  userId: number;
  name: string;
  email: string;
  role: string;
  activeTenantId?: number | null;
};

export async function pruneStaleSessions() {
  const now = new Date();

  return db.session.deleteMany({
    where: {
      OR: [
        {
          expiresAt: {
            lte: now,
          },
        },
        {
          revokedAt: {
            not: null,
          },
        },
      ],
    },
  });
}

export async function getSessionFromToken(token?: string | null) {
  if (!token) {
    return null;
  }

  const session = await db.session.findUnique({
    where: {
      id: hashSessionToken(token),
    },
    select: {
      activeTenantId: true,
      expiresAt: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    return null;
  }

  return {
    userId: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role.toLowerCase(),
    activeTenantId: session.activeTenantId,
  } satisfies SessionPayload;
}

export async function createSessionRecord({
  token,
  userId,
  activeTenantId,
}: {
  token: string;
  userId: number;
  activeTenantId?: number | null;
}) {
  try {
    await pruneStaleSessions();
  } catch {
    // Session creation should not fail just because best-effort cleanup failed.
  }

  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.session.create({
    data: {
      id: hashSessionToken(token),
      userId,
      activeTenantId: activeTenantId ?? null,
      expiresAt,
    },
  });

  return expiresAt;
}

export async function revokeSessionToken(token?: string | null) {
  if (!token) {
    return;
  }

  try {
    await db.session.update({
      where: {
        id: hashSessionToken(token),
      },
      data: {
        revokedAt: new Date(),
      },
    });
  } catch {
    // Missing or already-cleared sessions do not need to block cookie cleanup.
  }
}

export async function revokeUserSessionsExcept(userId: number, token?: string | null) {
  const currentSessionId = token ? hashSessionToken(token) : null;

  await db.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(currentSessionId
        ? {
            id: {
              not: currentSessionId,
            },
          }
        : {}),
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

export async function updateSessionActiveTenant(
  token: string,
  activeTenantId: number | null
) {
  await db.session.update({
    where: {
      id: hashSessionToken(token),
    },
    data: {
      activeTenantId,
    },
  });
}
