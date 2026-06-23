import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  LayoutDashboard,
  ListTodo,
  Megaphone,
  ShoppingCart,
  SquareKanban,
} from "lucide-react";

import { PageBase } from "@/components/pages/page-base";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UserRole } from "@/generated/prisma/enums";
import { verifySession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/utils/currency";
import { formatAppDate } from "@/lib/utils/date";

function canViewAll(role?: string) {
  return role?.toUpperCase() === UserRole.ADMIN;
}

function startOfToday() {
  const today = new Date();

  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function startOfNextDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfNextMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function metricValue(value: number, suffix = "") {
  return `${new Intl.NumberFormat("pt-PT").format(value)}${suffix}`;
}

export default async function Home() {
  const session = await verifySession();
  const canSeeAllTenants = canViewAll(session.role);
  let tenant: { id: number; name: string; deletedAt: Date | null } | null = null;

  if (session.activeTenantId) {
    if (canSeeAllTenants) {
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

  const tenantFilter = canSeeAllTenants
    ? tenant
      ? { tenantId: tenant.id }
      : {}
    : tenant
      ? { tenantId: tenant.id }
      : { id: -1 };
  const todayStart = startOfToday();
  const tomorrowStart = startOfNextDay(todayStart);
  const monthStart = startOfMonth(todayStart);
  const nextMonthStart = startOfNextMonth(todayStart);

  const [
    openTasks,
    dueTodayTasks,
    overdueTasks,
    completedTasks,
    boardCount,
    monthlySales,
    monthlyMarketing,
    recentTasks,
  ] = await Promise.all([
    db.task.count({
      where: {
        ...tenantFilter,
        completed: false,
      },
    }),
    db.task.count({
      where: {
        ...tenantFilter,
        completed: false,
        dueDate: {
          gte: todayStart,
          lt: tomorrowStart,
        },
      },
    }),
    db.task.count({
      where: {
        ...tenantFilter,
        completed: false,
        dueDate: {
          lt: todayStart,
        },
      },
    }),
    db.task.count({
      where: {
        ...tenantFilter,
        completed: true,
      },
    }),
    db.board.count({
      where: tenantFilter,
    }),
    db.redicomSale.aggregate({
      where: {
        ...tenantFilter,
        encomendaData: {
          gte: monthStart,
          lt: nextMonthStart,
        },
      },
      _sum: {
        encomendaValorTotal: true,
        quantidadeUni: true,
      },
      _count: {
        id: true,
      },
    }),
    db.marketingExpense.aggregate({
      where: {
        ...tenantFilter,
        day: {
          gte: monthStart,
          lt: nextMonthStart,
        },
      },
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    }),
    db.task.findMany({
      where: tenantFilter,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 6,
      select: {
        completed: true,
        dueDate: true,
        id: true,
        title: true,
        tenant: {
          select: {
            name: true,
          },
        },
        updatedAt: true,
        column: {
          select: {
            name: true,
            board: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const scopeDescription = canSeeAllTenants
    ? tenant
      ? `Visão operacional de ${tenant.name}.`
      : "Visão operacional consolidada de todas as organizações."
    : tenant
      ? `Visão operacional de ${tenant.name}.`
      : "Selecione uma organização na barra lateral para ver o painel.";
  const salesTotal = Number(monthlySales._sum.encomendaValorTotal ?? 0);
  const salesQuantity = Number(monthlySales._sum.quantidadeUni ?? 0);
  const marketingTotal = Number(monthlyMarketing._sum.amount ?? 0);

  return (
    <PageBase
      icon={LayoutDashboard}
      label="Painel"
      title="Dashboard"
      description={scopeDescription}
      action={
        <Link href="/boards" className={buttonVariants({ className: "w-full sm:w-auto" })}>
          Abrir quadros
          <ArrowRight />
        </Link>
      }
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Tarefas abertas</CardTitle>
            <CardDescription>Trabalho ainda por concluir</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{metricValue(openTasks)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Para hoje</CardTitle>
            <CardDescription>Tarefas com prazo hoje</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{metricValue(dueTodayTasks)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Atrasadas</CardTitle>
            <CardDescription>Prazos vencidos e por fechar</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{metricValue(overdueTasks)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quadros</CardTitle>
            <CardDescription>Quadros ativos no escopo atual</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{metricValue(boardCount)}</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Vendas do mês</CardTitle>
            <CardDescription>
              {monthlySales._count.id} linhas REDICOM registadas
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <p className="text-2xl font-semibold">{formatCurrency(salesTotal)}</p>
            <p className="text-sm text-muted-foreground">
              {metricValue(salesQuantity)} unidades vendidas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Marketing do mês</CardTitle>
            <CardDescription>
              {monthlyMarketing._count.id} despesas registadas
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <p className="text-2xl font-semibold">
              {formatCurrency(marketingTotal, "negative")}
            </p>
            <p className="text-sm text-muted-foreground">
              Investimento registado no período atual
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Execução</CardTitle>
            <CardDescription>Tarefas concluídas no escopo atual</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <p className="text-2xl font-semibold">{metricValue(completedTasks)}</p>
            <p className="text-sm text-muted-foreground">
              Histórico de trabalho concluído
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Tarefas recentes</CardTitle>
            <CardDescription>Últimas alterações nos quadros</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {recentTasks.length > 0 ? (
              <div className="divide-y divide-border">
                {recentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {task.completed ? (
                          <CheckCircle2 className="size-4 text-muted-foreground" />
                        ) : task.dueDate && task.dueDate < todayStart ? (
                          <CircleAlert className="size-4 text-destructive" />
                        ) : (
                          <ListTodo className="size-4 text-muted-foreground" />
                        )}
                        <p className="truncate text-sm font-medium">{task.title}</p>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {[
                          task.column?.board?.name,
                          task.column?.name,
                          canSeeAllTenants && !tenant ? task.tenant?.name : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Sem quadro"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      {task.dueDate ? (
                        <Badge variant="outline">
                          {formatAppDate(task.dueDate, "dd-MM-yyyy")}
                        </Badge>
                      ) : null}
                      <span>{formatAppDate(task.updatedAt, "dd-MM")}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Ainda não existem tarefas para mostrar neste painel.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acessos rápidos</CardTitle>
            <CardDescription>Saltos para os fluxos principais</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Link
              href="/calendar"
              className={buttonVariants({
                variant: "outline",
                className: "justify-start",
              })}
            >
              <CalendarClock />
              Calendário
            </Link>
            <Link
              href="/sales/reports"
              className={buttonVariants({
                variant: "outline",
                className: "justify-start",
              })}
            >
              <ShoppingCart />
              Relatórios de vendas
            </Link>
            <Link
              href="/marketing/reports"
              className={buttonVariants({
                variant: "outline",
                className: "justify-start",
              })}
            >
              <Megaphone />
              Relatórios de marketing
            </Link>
            <Link
              href="/boards"
              className={buttonVariants({
                variant: "outline",
                className: "justify-start",
              })}
            >
              <SquareKanban />
              Quadros
            </Link>
          </CardContent>
        </Card>
      </section>
    </PageBase>
  );
}
