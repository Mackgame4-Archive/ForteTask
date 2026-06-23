import { ShoppingCart } from "lucide-react";

import { BarChart, LineChart, PieChart } from "@/components/charts";
import { PageBase } from "@/components/pages/page-base";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ChartConfig } from "@/components/ui/chart";
import { UserRole } from "@/generated/prisma/enums";
import { verifySession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/utils/currency";
import { formatAppDate } from "@/lib/utils/date";

const totalChartConfig = {
  total: {
    label: "Total",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const quantityChartConfig = {
  quantidade: {
    label: "Quantidade",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

type DailySalesChartRow = {
  day: string;
} & Record<string, number | string>;

type OrganizationSummary = {
  key: string;
  lines: number;
  name: string;
  total: number;
};

function chartColor(index: number) {
  return `var(--chart-${(index % 5) + 1})`;
}

function addToMap(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) ?? 0) + value);
}

function mapToChartData(
  map: Map<string, number>,
  keyName: string,
  valueName: string,
  limit?: number
) {
  return [...map.entries()]
    .sort(([, firstValue], [, secondValue]) => secondValue - firstValue)
    .slice(0, limit)
    .map(([label, value], index) => ({
      key: `${keyName}_${index}`,
      [keyName]: label,
      [valueName]: value,
      fill: chartColor(index),
    }));
}

function makePieConfig(
  data: Array<{ key: string; fill: string }>,
  labels: Map<string, string>
) {
  return Object.fromEntries(
    data.map((row, index) => [
      row.key,
      {
        label: labels.get(row.key) ?? row.key,
        color: chartColor(index),
      },
    ])
  ) satisfies ChartConfig;
}

function canViewAllSales(role?: string) {
  return role?.toUpperCase() === UserRole.ADMIN;
}

function getOrganizationKey(tenantId: number | null) {
  return tenantId ? `tenant_${tenantId}` : "tenant_unassigned";
}

export default async function SalesReportsPage() {
  const session = await verifySession();
  const canViewAll = canViewAllSales(session.role);
  let tenant: { id: number; name: string; deletedAt: Date | null } | null = null;

  if (session.activeTenantId) {
    if (canViewAll) {
      tenant = await db.tenant.findUnique({
        where: {
          id: session.activeTenantId,
        },
        select: {
          deletedAt: true,
          id: true,
          name: true,
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
              deletedAt: true,
              id: true,
              name: true,
            },
          },
        },
      });

      tenant = membership?.tenant ?? null;
    }
  }

  tenant = tenant?.deletedAt ? null : tenant;

  const sales = await db.redicomSale.findMany({
    where: canViewAll
      ? tenant
        ? {
            tenantId: tenant.id,
          }
        : undefined
      : tenant
        ? {
            tenantId: tenant.id,
          }
        : {
            id: -1,
          },
    orderBy: [{ encomendaData: "asc" }, { id: "asc" }],
    select: {
      categoria: true,
      encomendaData: true,
      encomendaValorTotal: true,
      genero: true,
      id: true,
      quantidadeUni: true,
      tenant: {
        select: {
          id: true,
          name: true,
        },
      },
      tenantId: true,
    },
  });
  const dayTotals = new Map<string, DailySalesChartRow>();
  const genderQuantities = new Map<string, number>();
  const genderLineCounts = new Map<string, number>();
  const categoryTotals = new Map<string, number>();
  const organizations = new Map<string, OrganizationSummary>();
  let totalValue = 0;
  let totalQuantity = 0;

  for (const sale of sales) {
    const value = Number(sale.encomendaValorTotal ?? 0);
    const quantity = Number(sale.quantidadeUni ?? 0);
    const gender = sale.genero || "Sem género";
    const category = sale.categoria || "Sem categoria";
    const organizationKey = getOrganizationKey(sale.tenantId);
    const organization = sale.tenant?.name ?? "Sem organização";
    const organizationSummary = organizations.get(organizationKey) ?? {
      key: organizationKey,
      lines: 0,
      name: organization,
      total: 0,
    };

    totalValue += value;
    totalQuantity += quantity;
    addToMap(genderQuantities, gender, quantity);
    addToMap(genderLineCounts, gender, 1);
    addToMap(categoryTotals, category, value);
    organizationSummary.lines += 1;
    organizationSummary.total += value;
    organizations.set(organizationKey, organizationSummary);

    if (sale.encomendaData) {
      const dayKey = formatAppDate(sale.encomendaData, "yyyy-MM-dd");
      const currentDay = dayTotals.get(dayKey) ?? {
        day: formatAppDate(sale.encomendaData, "dd-MM"),
        total: 0,
      };
      currentDay[organizationKey] = Number(currentDay[organizationKey] ?? 0) + value;
      dayTotals.set(dayKey, currentDay);
    }
  }

  const organizationSummaries = [...organizations.values()].sort(
    (firstOrganization, secondOrganization) =>
      secondOrganization.total - firstOrganization.total
  );
  const dailyChartConfig = Object.fromEntries(
    organizationSummaries.map((organization, index) => [
      organization.key,
      {
        label: organization.name,
        color: chartColor(index),
      },
    ])
  ) satisfies ChartConfig;
  const dailyChartSeries = organizationSummaries.map((organization) => ({
    dataKey: organization.key,
    name: organization.name,
  }));
  const dailyChartData = [...dayTotals.entries()]
    .sort(([firstDay], [secondDay]) => firstDay.localeCompare(secondDay))
    .map(([, value]) => {
      for (const organization of organizationSummaries) {
        value[organization.key] ??= 0;
      }

      return value;
    });
  const genderQuantityData = mapToChartData(
    genderQuantities,
    "genero",
    "quantidade"
  );
  const categoryTotalData = mapToChartData(
    categoryTotals,
    "categoria",
    "total",
    10
  );
  const genderPieData = mapToChartData(genderLineCounts, "genero", "value").map(
    (row) => ({
      key: row.key,
      value: Number(row.value),
      fill: row.fill,
      label: String(row.genero),
    })
  );
  const genderLabels = new Map(genderPieData.map((row) => [row.key, row.label]));
  const genderPieConfig = makePieConfig(genderPieData, genderLabels);
  const averageOrderValue = sales.length > 0 ? totalValue / sales.length : 0;
  const description = canViewAll
    ? tenant
      ? `Resumo geral das vendas REDICOM importadas para ${tenant.name}.`
      : "Resumo geral das vendas REDICOM importadas para todas as organizações."
    : tenant
      ? `Resumo geral das vendas REDICOM importadas para ${tenant.name}.`
      : "Selecione uma organização na barra lateral para ver o relatório de vendas.";

  return (
    <PageBase
      icon={ShoppingCart}
      label="Vendas"
      title="Relatório de vendas"
      description={description}
    >
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total vendido</CardTitle>
            <CardDescription>Valor acumulado das encomendas</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatCurrency(totalValue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quantidade</CardTitle>
            <CardDescription>Unidades registadas no relatório</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{totalQuantity}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Valor médio</CardTitle>
            <CardDescription>Por linha importada</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatCurrency(averageOrderValue)}
            </p>
          </CardContent>
        </Card>
      </section>

      {canViewAll && !tenant && organizationSummaries.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {organizationSummaries.map((organization) => (
            <Card key={organization.name}>
              <CardHeader>
                <CardTitle>{organization.name}</CardTitle>
                <CardDescription>
                  {organization.lines} linhas de vendas registadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold">
                  {formatCurrency(organization.total)}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}

      {sales.length > 0 ? (
        <>
          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Evolução diária</CardTitle>
                <CardDescription>Valor vendido por dia</CardDescription>
              </CardHeader>
              <CardContent>
                <LineChart
                  config={dailyChartConfig}
                  data={dailyChartData}
                  series={dailyChartSeries}
                  xAxisKey="day"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quantidade por género</CardTitle>
                <CardDescription>Unidades vendidas por género</CardDescription>
              </CardHeader>
              <CardContent>
                <BarChart
                  config={quantityChartConfig}
                  data={genderQuantityData}
                  series={[{ dataKey: "quantidade" }]}
                  xAxisKey="genero"
                  showLegend={false}
                />
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Top categorias</CardTitle>
                <CardDescription>Valor vendido por categoria</CardDescription>
              </CardHeader>
              <CardContent>
                <BarChart
                  config={totalChartConfig}
                  data={categoryTotalData}
                  layout="vertical"
                  series={[{ dataKey: "total" }]}
                  xAxisKey="categoria"
                  showLegend={false}
                  className="h-80"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribuição</CardTitle>
                <CardDescription>Peso por linhas de género</CardDescription>
              </CardHeader>
              <CardContent>
                <PieChart
                  config={genderPieConfig}
                  data={genderPieData}
                  dataKey="value"
                  nameKey="key"
                />
              </CardContent>
            </Card>
          </section>
        </>
      ) : (
        <section className="border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
          Ainda não existem vendas REDICOM importadas para gerar relatórios.
        </section>
      )}
    </PageBase>
  );
}
