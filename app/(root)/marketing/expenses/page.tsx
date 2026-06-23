import { Megaphone } from "lucide-react";

import { createMarketingExpenseAction } from "@/app/(root)/marketing/actions";
import { CreateAlert } from "@/components/create-alert";
import { CreateAlertDialog } from "@/components/create-alert-dialog";
import { CurrencyInput } from "@/components/currency-input";
import { DateInputPicker } from "@/components/date-picker";
import { PageBase } from "@/components/page-base";
import {
  MarketingExpensesTable,
  type MarketingExpenseRow,
} from "@/components/pages/marketing/marketing-expenses-table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarketingPlatform } from "@/generated/prisma/enums";
import { verifySession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { appCurrencySymbol } from "@/lib/utils/currency";
import { formatAppDate } from "@/lib/utils/date";
import { formatEnumValue } from "@/lib/utils/enum";

const platformOptions = Object.values(MarketingPlatform).map((platform) => ({
  value: platform,
  label: formatEnumValue(platform),
}));

type MarketingExpensesPageProps = {
  searchParams?: Promise<MarketingExpensesSearchParams>;
};

type MarketingExpensesSearchParams = {
  error?: string;
  saved?: string;
};

function canManageExpenses(role?: string) {
  return role === "admin" || role === "manager";
}

function canViewAllExpenses(role?: string) {
  return role === "admin";
}

export default async function MarketingExpensesPage({
  searchParams,
}: MarketingExpensesPageProps) {
  const [session, params] = await Promise.all([
    verifySession(),
    searchParams ?? Promise.resolve({} as MarketingExpensesSearchParams),
  ]);
  const canManage = canManageExpenses(session.role);
  const canViewAll = canViewAllExpenses(session.role);
  let tenant: { id: number; name: string; deletedAt: Date | null } | null = null;

  if (session.activeTenantId) {
    if (canViewAll) {
      tenant = await db.tenant.findUnique({
        where: {
          id: session.activeTenantId,
        },
        select: {
          id: true,
          name: true,
          deletedAt: true,
        },
      });
    } else {
      const membership = await db.tenantUser.findUnique({
        where: {
          userId_tenantId: {
            userId: session.userId,
            tenantId: session.activeTenantId,
          },
        },
        select: {
          tenant: {
            select: {
              id: true,
              name: true,
              deletedAt: true,
            },
          },
        },
      });

      tenant = membership?.tenant ?? null;
    }
  }

  tenant = tenant?.deletedAt ? null : tenant;

  const expenses = canViewAll
    ? await db.marketingExpense.findMany({
        where: tenant
          ? {
              tenantId: tenant.id,
            }
          : undefined,
        orderBy: [{ day: "desc" }, { createdAt: "desc" }],
        include: {
          tenant: {
            select: {
              name: true,
            },
          },
        },
      })
    : tenant
      ? await db.marketingExpense.findMany({
          where: {
            tenantId: tenant.id,
          },
          orderBy: [{ day: "desc" }, { createdAt: "desc" }],
          include: {
            tenant: {
              select: {
                name: true,
              },
            },
          },
        })
      : [];
  const expenseRows: MarketingExpenseRow[] = expenses.map((expense) => ({
    id: expense.id,
    amount: String(expense.amount),
    createdAt: formatAppDate(expense.createdAt, "dd-MM-yyyy"),
    day: formatAppDate(expense.day, "dd-MM-yyyy"),
    organization: expense.tenant.name,
    platform: expense.platform,
  }));

  return (
    <PageBase
      icon={Megaphone}
      label="Marketing"
      title="Despesas de marketing"
      description={
        canViewAll && !tenant
          ? "Despesas diarias registadas para todas as organizacoes."
          : tenant
          ? `Despesas diarias registadas para ${tenant.name}.`
          : "Selecione uma organizacao na barra lateral para ver despesas de marketing."
      }
    >
      <CreateAlertDialog error={params.error} />

      <CreateAlert type="success" title={params.saved} />

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Registar despesa diaria</CardTitle>
            <CardDescription>
              Introduza o valor gasto por plataforma para um dia especifico.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tenant ? (
              <form
                action={createMarketingExpenseAction}
                className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
              >
                <div className="space-y-2">
                  <Label>Plataforma</Label>
                  <Select
                    name="platform"
                    defaultValue="META_ADS"
                    items={platformOptions}
                    required
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecionar plataforma" />
                    </SelectTrigger>
                    <SelectContent>
                      {platformOptions.map((platform) => (
                        <SelectItem
                          key={platform.value}
                          value={platform.value}
                          label={platform.label}
                        >
                          {platform.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Despesa</Label>
                  <CurrencyInput
                    id="amount"
                    name="amount"
                    currency={appCurrencySymbol}
                    min="0.01"
                    polarity="negative"
                    placeholder="0,00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="day">Dia</Label>
                  <DateInputPicker
                    id="day"
                    name="day"
                    defaultValue={new Date()}
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2 xl:col-span-1">
                  <Label className="invisible">Acao</Label>
                  <Button type="submit" className="h-8 w-full xl:w-auto">
                    Guardar despesa
                  </Button>
                </div>
              </form>
            ) : (
              <p className="border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                Selecione uma organizacao antes de registar despesas.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <section className="border border-border bg-card text-card-foreground">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Despesas registadas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {canViewAll
              ? tenant
                ? "Consulte os valores diarios guardados para a organizacao selecionada."
                : "Consulte os valores diarios guardados para todas as organizacoes."
              : "Consulte os valores diarios guardados na base de dados."}
          </p>
        </div>

        {expenseRows.length > 0 ? (
          <div className="p-4">
            <MarketingExpensesTable
              rows={expenseRows}
              showOrganization={canViewAll && !tenant}
            />
          </div>
        ) : (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            Ainda nao existem despesas de marketing registadas.
          </div>
        )}
      </section>
    </PageBase>
  );
}
