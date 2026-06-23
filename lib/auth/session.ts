import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import type { UserModel } from "@/generated/prisma/models/User";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session-cookie";
import {
  createSessionRecord,
  getSessionFromToken,
  revokeUserSessionsExcept,
  revokeSessionToken,
  updateSessionActiveTenant,
  type SessionPayload,
} from "@/lib/auth/session-store";

function shouldUseSecureCookies() {
  const configuredValue = process.env.USE_HTTPS?.toLowerCase();

  if (configuredValue === "true") {
    return true;
  }

  if (configuredValue === "false") {
    return false;
  }

  return (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_BASE_URL?.startsWith("https://") !== false
  );
}

async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

async function getSessionToken() {
  const cookieStore = await cookies();

  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function createSession(payload: Pick<SessionPayload, "userId" | "activeTenantId">) {
  const currentToken = await getSessionToken();
  const token = createSessionToken();
  const expiresAt = await createSessionRecord({
    token,
    userId: payload.userId,
    activeTenantId: payload.activeTenantId,
  });

  await revokeSessionToken(currentToken);
  await setSessionCookie(token, expiresAt);
}

export async function createSessionUser(
  user: Pick<UserModel, "id" | "name" | "email" | "role">,
  session?: Pick<SessionPayload, "activeTenantId"> | null
) {
  await createSession({
    userId: user.id,
    activeTenantId: session?.activeTenantId ?? null,
  });
}

export async function getSession() {
  return getSessionFromToken(await getSessionToken());
}

export async function requireSession() {
  const session = await getSession();

  if (!session?.userId) {
    redirect("/login");
  }

  return session;
}

export const verifySession = cache(async () => {
  return requireSession();
});

export async function updateCurrentSessionActiveTenant(activeTenantId: number | null) {
  const token = await getSessionToken();

  if (!token) {
    return;
  }

  await updateSessionActiveTenant(token, activeTenantId);
}

export async function revokeOtherCurrentUserSessions(userId: number) {
  await revokeUserSessionsExcept(userId, await getSessionToken());
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  await revokeSessionToken(token);
  cookieStore.delete(SESSION_COOKIE_NAME);
}
