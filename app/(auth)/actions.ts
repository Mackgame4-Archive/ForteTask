"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import {
  createSessionUser,
  deleteSession,
  getSession,
  updateCurrentSessionActiveTenant,
} from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createPasswordResetToken,
  findValidPasswordResetToken,
} from "@/lib/auth/password-reset";
import { sendPasswordResetEmail } from "@/lib/email/password-reset";
import { checkRateLimit, clearRateLimit } from "@/lib/utils/rate-limit";
import { UserRole } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/schemas/auth";

export type AuthActionState = {
  error?: string;
  resetUrl?: string;
  success?: string;
};

const LOGIN_IP_LIMIT = {
  limit: 20,
  windowMs: 60_000,
};

const LOGIN_ACCOUNT_LIMIT = {
  limit: 8,
  windowMs: 15 * 60_000,
};

const SIGNUP_IP_LIMIT = {
  limit: 5,
  windowMs: 10 * 60_000,
};

const SIGNUP_EMAIL_LIMIT = {
  limit: 3,
  windowMs: 60 * 60_000,
};

const PASSWORD_RESET_IP_LIMIT = {
  limit: 10,
  windowMs: 10 * 60_000,
};

const PASSWORD_RESET_EMAIL_LIMIT = {
  limit: 3,
  windowMs: 60 * 60_000,
};

async function getClientIp() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();

  return (
    headerStore.get("cf-connecting-ip") ??
    headerStore.get("x-real-ip") ??
    forwardedFor ??
    "unknown"
  );
}

async function getRequestOrigin() {
  const headerStore = await headers();
  const configuredUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.APP_URL;

  if (configuredUrl?.startsWith("http://") || configuredUrl?.startsWith("https://")) {
    return configuredUrl.replace(/\/$/, "");
  }

  const host = headerStore.get("host") ?? configuredUrl ?? "localhost:3000";
  const protocol =
    headerStore.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");

  return `${protocol}://${host}`;
}

function rateLimitError(retryAfterSeconds: number) {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));

  return `Demasiadas tentativas. Tente novamente dentro de ${minutes} minuto${minutes === 1 ? "" : "s"}.`;
}

function passwordResetSentState(resetUrl?: string): AuthActionState {
  return {
    success:
      "Se existir uma conta com esse email, enviámos instruções para recuperar a palavra-passe.",
    ...(process.env.NODE_ENV !== "production" && resetUrl ? { resetUrl } : {}),
  };
}

export async function login(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Introduza um email e uma palavra-passe válidos." };
  }

  const clientIp = await getClientIp();
  const loginIpKey = `login:ip:${clientIp}`;
  const loginAccountKey = `login:account:${clientIp}:${parsed.data.email}`;
  const loginRateLimit = await checkRateLimit([
    {
      key: loginIpKey,
      ...LOGIN_IP_LIMIT,
    },
    {
      key: loginAccountKey,
      ...LOGIN_ACCOUNT_LIMIT,
    },
  ]);

  if (!loginRateLimit.allowed) {
    return { error: rateLimitError(loginRateLimit.retryAfterSeconds) };
  }

  let user = null;

  try {
    user = await db.user.findUnique({
      where: {
        email: parsed.data.email,
      },
      include: {
        tenants: {
          where: {
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
            tenantId: true,
          },
        },
      },
    });
  } catch {
    return { error: "Não foi possível ligar à base de dados. Tente novamente dentro de instantes." };
  }

  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Email ou palavra-passe inválidos." };
  }

  await clearRateLimit([loginAccountKey]);

  await createSessionUser(user, {
    activeTenantId: user.tenants[0]?.tenantId ?? null,
  });

  redirect("/");
}

export async function signup(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Verifique os campos do formulário e tente novamente." };
  }

  const clientIp = await getClientIp();
  const signupRateLimit = await checkRateLimit([
    {
      key: `signup:ip:${clientIp}`,
      ...SIGNUP_IP_LIMIT,
    },
    {
      key: `signup:email:${parsed.data.email}`,
      ...SIGNUP_EMAIL_LIMIT,
    },
  ]);

  if (!signupRateLimit.allowed) {
    return { error: rateLimitError(signupRateLimit.retryAfterSeconds) };
  }

  let user = null;

  try {
    const existingUser = await db.user.findUnique({
      where: {
        email: parsed.data.email,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      return { error: "Já existe uma conta com esse email." };
    }

    user = await db.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: await hashPassword(parsed.data.password),
        role: UserRole.MEMBER,
      },
    });
  } catch {
    return { error: "Não foi possível criar a conta. Verifique a base de dados e tente novamente." };
  }

  if (!user) {
    return { error: "Não foi possível criar a conta. Tente novamente." };
  }

  await createSessionUser(user);

  redirect("/");
}

export async function requestPasswordReset(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: "Introduza um email válido." };
  }

  const clientIp = await getClientIp();
  const resetRateLimit = await checkRateLimit([
    {
      key: `password-reset:ip:${clientIp}`,
      ...PASSWORD_RESET_IP_LIMIT,
    },
    {
      key: `password-reset:email:${parsed.data.email}`,
      ...PASSWORD_RESET_EMAIL_LIMIT,
    },
  ]);

  if (!resetRateLimit.allowed) {
    return { error: rateLimitError(resetRateLimit.retryAfterSeconds) };
  }

  const user = await db.user.findUnique({
    where: {
      email: parsed.data.email,
    },
    select: {
      email: true,
      id: true,
    },
  });

  if (!user) {
    return passwordResetSentState();
  }

  await db.passwordResetToken.updateMany({
    where: {
      userId: user.id,
      usedAt: null,
    },
    data: {
      usedAt: new Date(),
    },
  });

  const { token } = await createPasswordResetToken(user.id);
  const resetUrl = `${await getRequestOrigin()}/reset-password?token=${encodeURIComponent(token)}`;

  try {
    await sendPasswordResetEmail({
      email: user.email,
      resetUrl,
    });
  } catch (error) {
    console.error(error);
  }

  return passwordResetSentState(resetUrl);
}

export async function resetPassword(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "O link é inválido ou a palavra-passe é demasiado curta." };
  }

  const passwordResetToken = await findValidPasswordResetToken(parsed.data.token);

  if (!passwordResetToken) {
    return { error: "O link de recuperação é inválido ou expirou." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const updated = await db.$transaction(async (tx) => {
    const consumedToken = await tx.passwordResetToken.updateMany({
      where: {
        expiresAt: {
          gt: new Date(),
        },
        id: passwordResetToken.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    if (consumedToken.count !== 1) {
      return false;
    }

    await tx.user.update({
      where: {
        id: passwordResetToken.userId,
      },
      data: {
        passwordHash,
      },
    });
    await tx.session.updateMany({
      where: {
        userId: passwordResetToken.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return true;
  });

  if (!updated) {
    return { error: "O link de recuperação é inválido ou expirou." };
  }

  return {
    success: "Palavra-passe atualizada. Já pode entrar com a nova palavra-passe.",
  };
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

export async function setActiveTenantAction(tenantId: number | null) {
  const session = await getSession();

  if (!session?.userId) {
    return;
  }

  if (tenantId === null) {
    await updateCurrentSessionActiveTenant(null);
    return;
  }

  if (session.role === "admin") {
    const tenant = await db.tenant.findUnique({
      where: {
        id: tenantId,
      },
      select: {
        id: true,
        deletedAt: true,
      },
    });

    if (!tenant || tenant.deletedAt) {
      return;
    }

    await updateCurrentSessionActiveTenant(tenant.id);
    return;
  }

  const membership = await db.tenantUser.findUnique({
    where: {
      userId_tenantId: {
        userId: session.userId,
        tenantId,
      },
    },
    select: {
      tenantId: true,
      tenant: {
        select: {
          deletedAt: true,
        },
      },
    },
  });

  if (!membership || membership.tenant.deletedAt) {
    return;
  }

  await updateCurrentSessionActiveTenant(membership.tenantId);
}
