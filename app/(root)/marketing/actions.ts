"use server";

import { redirect } from "next/navigation";

import { verifySession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { parseDateInputValue } from "@/lib/utils/date";
import { marketingExpenseSchema } from "@/schemas/marketing";

function canManageExpenses(role?: string) {
  return role === "admin" || role === "manager";
}

function expensesRedirect(
  message: string,
  type: "error" | "saved" = "saved"
): never {
  const params = new URLSearchParams({ [type]: message });
  redirect(`/marketing/expenses?${params.toString()}`);
}

export async function createMarketingExpenseAction(formData: FormData) {
  const session = await verifySession();

  if (!canManageExpenses(session.role)) {
    expensesRedirect("Não tem permissão para registar despesas.", "error");
  }

  if (!session.activeTenantId) {
    expensesRedirect("Selecione uma organização antes de registar despesas.", "error");
  }

  const parsed = marketingExpenseSchema.safeParse({
    platform: formData.get("platform"),
    amount: formData.get("amount"),
    day: formData.get("day"),
  });

  if (!parsed.success) {
    expensesRedirect("Preencha a plataforma, a despesa e o dia.", "error");
  }

  const membership = await db.tenantUser.findUnique({
    where: {
      userId_tenantId: {
        userId: session.userId,
        tenantId: session.activeTenantId,
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
    expensesRedirect("Não tem acesso a esta organização.", "error");
  }

  const parsedDay = parseDateInputValue(parsed.data.day);

  if (!parsedDay) {
    expensesRedirect("Introduza uma data válida.", "error");
  }

  const day = new Date(
    Date.UTC(parsedDay.getFullYear(), parsedDay.getMonth(), parsedDay.getDate())
  );

  await db.marketingExpense.upsert({
    where: {
      tenantId_platform_day: {
        tenantId: membership.tenantId,
        platform: parsed.data.platform,
        day,
      },
    },
    update: {
      amount: parsed.data.amount,
    },
    create: {
      tenantId: membership.tenantId,
      platform: parsed.data.platform,
      amount: parsed.data.amount,
      day,
    },
  });

  expensesRedirect("Despesa de marketing registada.");
}
