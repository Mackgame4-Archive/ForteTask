"use server";

import { redirect } from "next/navigation";

import { UserRole } from "@/generated/prisma/enums";
import { verifySession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  parseBooleanText,
  parseDateText,
  parseDateTimeText,
  parseDecimalText,
  parseIntegerText,
  parseText,
} from "@/lib/utils/text";
import { redicomHeaders, type RedicomCsvRow } from "@/app/(root)/sales/redicom";

function salesRedirect(
  message: string,
  type: "error" | "saved" = "saved"
): never {
  const params = new URLSearchParams({ [type]: message });
  redirect(`/sales/redicom?${params.toString()}`);
}

function canImportSales(role?: string) {
  return role?.toUpperCase() === UserRole.ADMIN;
}

function mapRedicomRow(row: RedicomCsvRow, tenantId: number) {
  const encomendaId = parseIntegerText(row.EncomendaID);

  if (!encomendaId) {
    return null;
  }

  return {
    encomendaId,
    tenantId,
    encomendaRef: parseText(row.EncomendaRef),
    encomendaEstado: parseText(row.EncomendaEstado),
    tipo: parseText(row.Tipo),
    canal: parseText(row.Canal),
    isaLoja: parseText(row.ISALoja),
    faturaData: parseDateText(row.FaturaData),
    fatura: parseText(row.Fatura),
    productSku: parseText(row.ProductSKU),
    productId: parseIntegerText(row.ProductID),
    quantidadeUni: parseDecimalText(row.QuantidadeUni),
    produtoValor: parseDecimalText(row.ProdutoValor),
    produtoValorRiscado: parseDecimalText(row.ProdutoValorRiscado),
    familiaNome: parseText(row.FamiliaNome),
    subFamiliaNome: parseText(row.SubFamiliaNome),
    marca: parseText(row.Marca),
    estacao: parseText(row.Estacao),
    genero: parseText(row.Genero),
    categoria: parseText(row.Categoria),
    subCategoria: parseText(row.SubCategoria),
    faixaEtaria: parseText(row.FaixaEtaria),
    encomendaData: parseDateText(row.EncomendaData),
    encomendaDataHora: parseDateTimeText(row.EncomendaDataHora),
    encomendaMoeda: parseText(row.EncomendaMoeda),
    encomendaCambio: parseDecimalText(row.EncomendaCambio),
    encomendaQuantidade: parseDecimalText(row.EncomendaQuantidade),
    encomendaValorTotal: parseDecimalText(row.EncomendaValorTotal),
    encomendaPortesValor: parseDecimalText(row.EncomendaPortesValor),
    metodoEntrega: parseText(row.MetodoEntrega),
    metodoEntregaId: parseIntegerText(row.MetodoEntregaID),
    servicoTransportadora: parseText(row.ServicoTransportadora),
    metodoPagamento: parseText(row.MetodoPagamento),
    encomendaPaga: parseBooleanText(row.EncomendaPaga),
    cupaoId: parseIntegerText(row.CupaoID),
    cupao: parseText(row.Cupao),
    desconto: parseDecimalText(row.Desconto),
    servicoPagamento: parseText(row.ServicoPagamento),
    clienteId: parseIntegerText(row.ClienteID),
    clienteNome: parseText(row.ClienteNome),
    clienteEmail: parseText(row.ClienteEmail),
    clienteCodigoErp: parseText(row.ClienteCodigoERP),
    clienteDataRegisto: parseDateText(row.ClienteDataRegisto),
    clienteRegistado: parseBooleanText(row.ClienteRegistado),
    codigoPostal: parseText(row.CodigoPostal),
    clientePais: parseText(row.ClientePais),
    pickupNome: parseText(row.PickupNome),
    encomendaArmazemId: parseIntegerText(row.EncomendaArmazemID),
    encomendaArmazem: parseText(row.EncomendaArmazem),
    encomendaPais: parseText(row.EncomendaPais),
    encomendaMercado: parseText(row.EncomendaMercado),
    paraOferecer: parseBooleanText(row.ParaOferecer),
    mensagemOferta: parseText(row.MensagemOferta),
  };
}

type RedicomSaleData = NonNullable<ReturnType<typeof mapRedicomRow>>;

function redicomSaleKey(
  row: Pick<RedicomSaleData, "encomendaId" | "encomendaRef"> & {
    tenantId: number | null;
  }
) {
  return `${row.tenantId ?? ""}\u0000${row.encomendaId}\u0000${row.encomendaRef ?? ""}`;
}

async function upsertRedicomSales(data: RedicomSaleData[]) {
  const latestRowsByKey = new Map<string, RedicomSaleData>();

  for (const row of data) {
    latestRowsByKey.set(redicomSaleKey(row), row);
  }

  const latestRows = [...latestRowsByKey.values()];
  const existingRows = await db.redicomSale.findMany({
    where: {
      OR: latestRows.map((row) => ({
        encomendaId: row.encomendaId,
        encomendaRef: row.encomendaRef,
        tenantId: row.tenantId,
      })),
    },
    select: {
      encomendaId: true,
      encomendaRef: true,
      id: true,
      tenantId: true,
    },
  });
  const existingIdsByKey = new Map(
    existingRows.map((row) => [redicomSaleKey(row), row.id])
  );
  let created = 0;
  let updated = 0;

  await db.$transaction(
    latestRows.map((row) => {
      const existingId = existingIdsByKey.get(redicomSaleKey(row));

      if (existingId) {
        updated += 1;

        return db.redicomSale.update({
          where: { id: existingId },
          data: row,
        });
      }

      created += 1;

      return db.redicomSale.create({ data: row });
    })
  );

  return { created, total: latestRows.length, updated };
}

export async function saveRedicomSalesAction(formData: FormData) {
  const session = await verifySession();

  if (!canImportSales(session.role)) {
    salesRedirect("Não tem permissão para importar vendas.", "error");
  }

  if (!session.activeTenantId) {
    salesRedirect("Selecione uma organização antes de importar vendas.", "error");
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
    salesRedirect("Não tem acesso a esta organização.", "error");
  }

  let rows: RedicomCsvRow[];

  try {
    rows = JSON.parse(String(formData.get("rows") ?? "[]")) as RedicomCsvRow[];
  } catch {
    salesRedirect("Não foi possível ler as linhas do CSV.", "error");
  }

  if (rows.length === 0) {
    salesRedirect("O CSV não tem linhas para guardar.", "error");
  }

  const missingHeaders = redicomHeaders.filter(
    (header) => !(header in (rows[0] ?? {}))
  );

  if (missingHeaders.length > 0) {
    salesRedirect(
      `O CSV não tem as colunas obrigatórias: ${missingHeaders.join(", ")}.`,
      "error"
    );
  }

  const data = rows
    .map((row) => mapRedicomRow(row, membership.tenantId))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (data.length === 0) {
    salesRedirect("O CSV não tem encomendas válidas para guardar.", "error");
  }

  const result = await upsertRedicomSales(data);

  salesRedirect(
    `${result.total} linhas REDICOM guardadas (${result.created} novas, ${result.updated} atualizadas).`
  );
}
