import { ShoppingCart } from "lucide-react";

import { CreateAlert } from "@/components/create-alert";
import { CreateAlertDialog } from "@/components/create-alert-dialog";
import { PageBase } from "@/components/pages/page-base";
import { RedicomImportPanel } from "@/components/pages/sales/redicom-import-panel";
import {
  normalizeRedicomText,
  redicomFields,
  type RedicomFieldKey,
  type RedicomSaleRow,
} from "@/app/(root)/sales/redicom";
import { UserRole } from "@/generated/prisma/enums";
import { verifySession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatAppDate } from "@/lib/utils/date";

type RedicomSalesPageProps = {
  searchParams?: Promise<RedicomSalesSearchParams>;
};

type RedicomSalesSearchParams = {
  error?: string;
  saved?: string;
};

function canImportSales(role?: string) {
  return role?.toUpperCase() === UserRole.ADMIN;
}

function canViewAllSales(role?: string) {
  return role?.toUpperCase() === UserRole.ADMIN;
}

function dateValue(value: Date | null) {
  return value ? formatAppDate(value, "dd-MM-yyyy") : "";
}

function dateTimeValue(value: Date | null) {
  return value ? formatAppDate(value, "dd-MM-yyyy HH:mm") : "";
}

function boolValue(value: boolean | null) {
  if (value === null) {
    return "";
  }

  return value ? "Sim" : "Não";
}

const dateFields = new Set<RedicomFieldKey>([
  "clienteDataRegisto",
  "encomendaData",
  "faturaData",
]);
const dateTimeFields = new Set<RedicomFieldKey>(["encomendaDataHora"]);
const booleanFields = new Set<RedicomFieldKey>([
  "clienteRegistado",
  "encomendaPaga",
  "paraOferecer",
]);

function rowValue(row: unknown, key: RedicomFieldKey) {
  const value = (row as Record<RedicomFieldKey, unknown>)[key];

  if (dateFields.has(key)) {
    return dateValue(value instanceof Date ? value : null);
  }

  if (dateTimeFields.has(key)) {
    return dateTimeValue(value instanceof Date ? value : null);
  }

  if (booleanFields.has(key)) {
    return boolValue(typeof value === "boolean" ? value : null);
  }

  return normalizeRedicomText(value);
}

export default async function RedicomSalesPage({
  searchParams,
}: RedicomSalesPageProps) {
  const [session, params] = await Promise.all([
    verifySession(),
    searchParams ?? Promise.resolve({} as RedicomSalesSearchParams),
  ]);
  const canViewAll = canViewAllSales(session.role);
  let tenant: { id: number; deletedAt: Date | null } | null = null;

  if (session.activeTenantId) {
    if (canViewAll) {
      tenant = await db.tenant.findUnique({
        where: {
          id: session.activeTenantId,
        },
        select: {
          deletedAt: true,
          id: true,
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
            },
          },
        },
      });

      tenant = membership?.tenant ?? null;
    }
  }

  tenant = tenant?.deletedAt ? null : tenant;

  const latestRows = canViewAll
    ? await db.redicomSale.findMany({
        where: tenant
          ? {
              tenantId: tenant.id,
            }
          : undefined,
        orderBy: [{ encomendaData: "desc" }, { id: "desc" }],
        take: 200,
      })
    : tenant
      ? await db.redicomSale.findMany({
          where: {
            tenantId: tenant.id,
          },
          orderBy: [{ encomendaData: "desc" }, { id: "desc" }],
          take: 200,
        })
      : [];
  const rows: RedicomSaleRow[] = latestRows.map((row) =>
    Object.fromEntries(
      redicomFields.map((field) => [field.key, rowValue(row, field.key)])
    ) as RedicomSaleRow
  );

  return (
    <PageBase
      icon={ShoppingCart}
      label="Vendas"
      title="Vendas REDICOM"
      description="Importe e consulte as vendas exportadas do REDICOM."
    >
      <CreateAlertDialog error={params.error} />
      <CreateAlert type="success" title={params.saved} />

      <section className="grid min-w-0 gap-4">
        <RedicomImportPanel
          canImport={canImportSales(session.role) && Boolean(tenant)}
          persistedRows={rows}
        />
      </section>
    </PageBase>
  );
}
