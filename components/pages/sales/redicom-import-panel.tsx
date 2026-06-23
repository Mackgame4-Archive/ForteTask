"use client";

import { useState } from "react";
import { Upload } from "lucide-react";

import { saveRedicomSalesAction } from "@/app/(root)/sales/actions";
import {
  normalizeRedicomText,
  redicomFields,
  redicomHeaders,
  type RedicomCsvHeader,
  type RedicomCsvRow,
  type RedicomSaleRow,
} from "@/app/(root)/sales/redicom";
import { FileInput } from "@/components/file-input";
import { RedicomSalesTable } from "@/components/pages/sales/redicom-sales-table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { parseCsv } from "@/lib/utils/csv";

type RedicomImportPanelProps = {
  canImport: boolean;
  persistedRows: RedicomSaleRow[];
};

function csvValue(row: RedicomCsvRow, key: RedicomCsvHeader) {
  return normalizeRedicomText(row[key]?.trim() ?? "");
}

function toPreviewRow(row: RedicomCsvRow): RedicomSaleRow {
  return Object.fromEntries(
    redicomFields.map((field) => [field.key, csvValue(row, field.csvHeader)])
  ) as RedicomSaleRow;
}

async function readCsvFile(file: File) {
  const bytes = await file.arrayBuffer();

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export function RedicomImportPanel({
  canImport,
  persistedRows,
}: RedicomImportPanelProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<RedicomCsvRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const rows = previewRows.length > 0 ? previewRows.map(toPreviewRow) : persistedRows;
  const isPreviewing = previewRows.length > 0;

  async function handleImportPreview() {
    setError(null);
    setPreviewRows([]);

    if (!selectedFile) {
      setError("Escolha um ficheiro CSV REDICOM.");
      return;
    }

    const rawRows = parseCsv(await readCsvFile(selectedFile)) as RedicomCsvRow[];

    if (rawRows.length === 0) {
      setError("O CSV não tem linhas para pré-visualizar.");
      return;
    }

    const missingHeaders = redicomHeaders.filter(
      (header) => !(header in (rawRows[0] ?? {}))
    );

    if (missingHeaders.length > 0) {
      setError(`O CSV não tem as colunas obrigatórias: ${missingHeaders.join(", ")}.`);
      return;
    }

    const parsedRows = rawRows.map(
      (row) =>
        Object.fromEntries(
          redicomHeaders.map((header) => [
            header,
            normalizeRedicomText(row[header]?.trim() ?? ""),
          ])
        ) as RedicomCsvRow
    );

    setPreviewRows(parsedRows);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Importar CSV</CardTitle>
          <CardDescription>
            Carregue o CSV para pré-visualizar as linhas antes de guardar na base
            de dados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canImport ? (
            <div className="space-y-2">
              <Label htmlFor="redicom-file">Ficheiro CSV</Label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <FileInput
                    id="redicom-file"
                    mode="input-button"
                    accept=".csv,text/csv"
                    buttonText="Escolher"
                    onFileChange={(file) => {
                      setSelectedFile(file);
                      setPreviewRows([]);
                      setError(null);
                    }}
                  />
                </div>
                <Button
                  type="button"
                  className="sm:w-auto"
                  disabled={!selectedFile}
                  onClick={handleImportPreview}
                >
                  <Upload />
                  Importar
                </Button>
              </div>
              {error ? (
                <p className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
              Apenas administradores podem importar vendas REDICOM.
            </p>
          )}
        </CardContent>
      </Card>

      <section className="min-w-0 overflow-hidden border border-border bg-card text-card-foreground">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">
            {isPreviewing ? "Pré-visualização REDICOM" : "Informação REDICOM"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isPreviewing
              ? "Estas linhas ainda não foram guardadas na base de dados."
              : "Últimas 200 linhas guardadas. Use a pesquisa para filtrar encomendas, produtos, clientes, marcas ou géneros."}
          </p>
        </div>
        <div className="min-w-0 p-4">
          <RedicomSalesTable
            rows={rows}
            actions={
              isPreviewing ? (
                <form action={saveRedicomSalesAction}>
                  <input
                    type="hidden"
                    name="rows"
                    value={JSON.stringify(previewRows)}
                  />
                  <Button type="submit" size="sm">
                    <Upload />
                    Guardar alterações
                  </Button>
                </form>
              ) : null
            }
          />
        </div>
      </section>
    </>
  );
}
