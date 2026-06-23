"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { formatCurrency } from "@/lib/utils/currency";
import { formatEnumValue } from "@/lib/utils/enum";

export type MarketingExpenseRow = {
  id: number;
  amount: string;
  createdAt: string;
  day: string;
  organization?: string;
  platform: string;
};

type MarketingExpensesTableProps = {
  rows: MarketingExpenseRow[];
  showOrganization?: boolean;
};

export function MarketingExpensesTable({
  rows,
  showOrganization = false,
}: MarketingExpensesTableProps) {
  const columns = useMemo<ColumnDef<MarketingExpenseRow>[]>(
    () => [
      {
        accessorKey: "day",
        header: "Dia",
      },
      ...(showOrganization
        ? [
            {
              accessorKey: "organization",
              header: "Organização",
            } satisfies ColumnDef<MarketingExpenseRow>,
          ]
        : []),
      {
        accessorKey: "platform",
        header: "Plataforma",
        cell: ({ row }) => formatEnumValue(row.original.platform),
      },
      {
        accessorKey: "amount",
        header: "Despesa",
        cell: ({ row }) => formatCurrency(row.original.amount, "negative"),
      },
      {
        accessorKey: "createdAt",
        header: "Registado em",
        cell: ({ row }) => row.original.createdAt,
      },
    ],
    [showOrganization]
  );

  return <DataTable columns={columns} data={rows} />;
}
