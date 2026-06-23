import { Megaphone } from "lucide-react";

import {
  AreaChart,
  BarChart,
  LineChart,
  PieChart,
  RadialChart,
} from "@/components/charts";
import { PageBase } from "@/components/page-base";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ChartConfig } from "@/components/ui/chart";
import { MarketingPlatform } from "@/generated/prisma/enums";
import { verifySession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/utils/currency";
import { formatAppDate } from "@/lib/utils/date";
import { formatEnumValue } from "@/lib/utils/enum";

const platformOptions = Object.values(MarketingPlatform).map((platform) => ({
  value: platform,
  label: formatEnumValue(platform),
}));

const platformChartConfig = platformOptions.reduce<ChartConfig>(
  (config, platform, index) => ({
    ...config,
    [platform.value]: {
      label: platform.label,
      color: `var(--chart-${index + 1})`,
    },
  }),
  {}
);

const totalChartConfig = {
  total: {
    label: "Total",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

function canViewAllExpenses(role?: string) {
  return role === "admin";
}

function getPlatformLabel(platform: string) {
  return (
    platformOptions.find((option) => option.value === platform)?.label ??
    formatEnumValue(platform)
  );
}

export default async function MarketingReportsPage() {
  const session = await verifySession();
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
        orderBy: [{ day: "asc" }, { createdAt: "asc" }],
        include: {
          tenant: {
            select: {
              id: true,
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
          orderBy: [{ day: "asc" }, { createdAt: "asc" }],
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })
      : [];
  const tenants = canViewAll && !tenant
    ? await db.tenant.findMany({
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
      })
    : [];
  const total = expenses.reduce(
    (sum, expense) => sum + Math.abs(Number(expense.amount)),
    0
  );
  const dayKeys = new Set<string>();
  const platformTotals = new Map<string, number>();
  const organizationTotals = new Map<number, number>();
  const organizationDays = new Map<number, Set<string>>();
  const organizationNames = new Map<number, string>();
  const dailyTotals = new Map<string, Record<string, number | string>>();

  for (const expense of expenses) {
    const amount = Math.abs(Number(expense.amount));
    const day = formatAppDate(expense.day, "dd-MM-yyyy");
    const dayLabel = formatAppDate(expense.day, "dd-MM");

    dayKeys.add(day);
    platformTotals.set(
      expense.platform,
      (platformTotals.get(expense.platform) ?? 0) + amount
    );
    organizationNames.set(expense.tenant.id, expense.tenant.name);
    organizationTotals.set(
      expense.tenant.id,
      (organizationTotals.get(expense.tenant.id) ?? 0) + amount
    );

    const organizationDayKeys =
      organizationDays.get(expense.tenant.id) ?? new Set<string>();
    organizationDayKeys.add(day);
    organizationDays.set(expense.tenant.id, organizationDayKeys);

    const daily = dailyTotals.get(day) ?? { day: dayLabel, total: 0 };
    daily.total = Number(daily.total) + amount;
    daily[expense.platform] = Number(daily[expense.platform] ?? 0) + amount;
    dailyTotals.set(day, daily);
  }

  const dailyChartData = Array.from(dailyTotals.values());
  const platformChartData = platformOptions.map((platform) => ({
    platform: platform.value,
    value: platformTotals.get(platform.value) ?? 0,
    fill: `var(--color-${platform.value})`,
  }));
  const platformBarData = platformOptions.map((platform) => ({
    platform: platform.label,
    total: platformTotals.get(platform.value) ?? 0,
  }));
  const organizationSummaries =
    tenants.length > 0
      ? tenants.map((currentTenant) => {
          const organizationTotal = organizationTotals.get(currentTenant.id) ?? 0;
          const days = organizationDays.get(currentTenant.id)?.size ?? 0;

          return {
            id: currentTenant.id,
            name: currentTenant.name,
            total: organizationTotal,
            days,
            average: days > 0 ? organizationTotal / days : 0,
          };
        })
      : Array.from(organizationTotals.entries()).map(([tenantId, value]) => {
          const days = organizationDays.get(tenantId)?.size ?? 0;

          return {
            id: tenantId,
            name: organizationNames.get(tenantId) ?? "Organizacao",
            total: value,
            days,
            average: days > 0 ? value / days : 0,
          };
        });
  const organizationChartData = organizationSummaries.map((organization) => ({
    organization: organization.name,
    total: organization.total,
  }));
  const topPlatform = platformChartData.reduce(
    (top, platform) => (platform.value > top.value ? platform : top),
    { platform: "total", value: 0, fill: "var(--color-total)" }
  );
  const topPlatformPercentage = total > 0 ? (topPlatform.value / total) * 100 : 0;
  const topPlatformChartConfig = {
    [topPlatform.platform]: {
      label:
        topPlatform.platform === "total"
          ? "Total"
          : getPlatformLabel(topPlatform.platform),
      color:
        topPlatform.platform === "total"
          ? "var(--chart-1)"
          : `var(--chart-${
              platformOptions.findIndex(
                (platform) => platform.value === topPlatform.platform
              ) + 1
            })`,
    },
  } satisfies ChartConfig;
  const topPlatformData = [
    {
      platform: topPlatform.platform,
      value: Number(topPlatformPercentage.toFixed(2)),
      fill:
        topPlatform.platform === "total"
          ? "var(--color-total)"
          : `var(--color-${topPlatform.platform})`,
    },
  ];
  const averagePerDay = dayKeys.size > 0 ? total / dayKeys.size : 0;
  const description = canViewAll
    ? tenant
      ? `Relatorio de despesas de marketing para ${tenant.name}.`
      : "Relatorio consolidado de despesas de marketing para todas as organizacoes."
    : tenant
      ? `Relatorio de despesas de marketing para ${tenant.name}.`
      : "Selecione uma organizacao na barra lateral para ver o relatorio de marketing.";

  return (
    <PageBase
      icon={Megaphone}
      label="Marketing"
      title="Relatorio de marketing"
      description={description}
    >
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total gasto</CardTitle>
            <CardDescription>Valor registado no periodo</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatCurrency(total, "negative")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Media diaria</CardTitle>
            <CardDescription>Com base nos dias registados</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatCurrency(averagePerDay, "negative")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dias com despesa</CardTitle>
            <CardDescription>Quantidade de dias no relatorio</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{dayKeys.size}</p>
          </CardContent>
        </Card>
      </section>

      {canViewAll && !tenant ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {organizationSummaries.map((organization) => (
            <Card key={organization.id}>
              <CardHeader>
                <CardTitle>{organization.name}</CardTitle>
                <CardDescription>
                  {organization.days} dias com despesa registada
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Total gasto</p>
                  <p className="text-xl font-semibold">
                    {formatCurrency(organization.total, "negative")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Media diaria</p>
                  <p className="text-sm font-medium">
                    {formatCurrency(organization.average, "negative")}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}

      {expenses.length > 0 ? (
        <>
          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Evolucao diaria</CardTitle>
                <CardDescription>Total gasto por dia</CardDescription>
              </CardHeader>
              <CardContent>
                <LineChart
                  config={totalChartConfig}
                  data={dailyChartData}
                  series={[{ dataKey: "total" }]}
                  xAxisKey="day"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Despesa por plataforma</CardTitle>
                <CardDescription>Evolucao diaria por canal</CardDescription>
              </CardHeader>
              <CardContent>
                <AreaChart
                  config={platformChartConfig}
                  data={dailyChartData}
                  series={platformOptions.map((platform) => ({
                    dataKey: platform.value,
                  }))}
                  xAxisKey="day"
                />
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Total por plataforma</CardTitle>
                <CardDescription>Comparacao de despesa acumulada</CardDescription>
              </CardHeader>
              <CardContent>
                <BarChart
                  config={totalChartConfig}
                  data={platformBarData}
                  series={[{ dataKey: "total" }]}
                  xAxisKey="platform"
                  showLegend={false}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribuicao</CardTitle>
                <CardDescription>Peso de cada plataforma no total</CardDescription>
              </CardHeader>
              <CardContent>
                <PieChart
                  config={platformChartConfig}
                  data={platformChartData}
                  dataKey="value"
                  nameKey="platform"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Maior plataforma</CardTitle>
                <CardDescription>Percentagem dentro do total</CardDescription>
              </CardHeader>
              <CardContent>
                <RadialChart
                  config={topPlatformChartConfig}
                  data={topPlatformData}
                  dataKey="value"
                  nameKey="platform"
                />
              </CardContent>
            </Card>
          </section>

          {canViewAll && !tenant ? (
            <Card>
              <CardHeader>
                <CardTitle>Total por organizacao</CardTitle>
                <CardDescription>
                  Comparacao entre organizacoes com despesas registadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BarChart
                  config={totalChartConfig}
                  data={organizationChartData}
                  layout="vertical"
                  series={[{ dataKey: "total" }]}
                  xAxisKey="organization"
                  showLegend={false}
                  className="h-80"
                />
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : (
        <section className="border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
          Ainda nao existem despesas de marketing suficientes para gerar o
          relatorio.
        </section>
      )}
    </PageBase>
  );
}
