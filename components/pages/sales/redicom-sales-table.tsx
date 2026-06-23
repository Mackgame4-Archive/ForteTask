"use client";

import { useMemo, type ReactNode } from "react";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";

import { redicomFields, type RedicomSaleRow } from "@/app/(root)/sales/redicom";
import { DataTable } from "@/components/data-table";

type RedicomSalesTableProps = {
  actions?: ReactNode;
  rows: RedicomSaleRow[];
};

export function RedicomSalesTable({ actions, rows }: RedicomSalesTableProps) {
  const columns = useMemo<ColumnDef<RedicomSaleRow>[]>(
    () =>
      redicomFields.map((field) => ({
        accessorKey: field.key,
        header: field.label,
      })),
    []
  );
  const initialColumnVisibility = useMemo<VisibilityState>(
    () =>
      Object.fromEntries(
        redicomFields
          .filter((field) => "hidden" in field && field.hidden)
          .map((field) => [field.key, false])
      ),
    []
  );

  return (
    <DataTable
      actions={actions}
      columns={columns}
      data={rows}
      emptyText="Ainda não existem vendas REDICOM importadas."
      initialColumnVisibility={initialColumnVisibility}
      pageSize={20}
    />
  );
}

export type { RedicomSaleRow };
