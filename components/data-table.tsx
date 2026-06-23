"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  ColumnDef,
  type PaginationState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown, SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { normalizeMojibakeText } from "@/lib/utils/text"

type DataTableColumnMeta = {
  cellClassName?: string
}

interface DataTableProps<TData, TValue> {
  actions?: ReactNode
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  emptyText?: string
  initialColumnVisibility?: VisibilityState
  pageSize?: number
  pagination?: boolean | "auto"
  showFooterSummary?: boolean
}

function getSearchableValue(value: unknown, seen = new WeakSet<object>()): string {
  if (value === null || value === undefined) {
    return ""
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value !== "object") {
    return normalizeMojibakeText(value)
  }

  if (seen.has(value)) {
    return ""
  }

  seen.add(value)

  if (Array.isArray(value)) {
    return value.map((item) => getSearchableValue(item, seen)).join(" ")
  }

  return Object.values(value)
    .map((item) => getSearchableValue(item, seen))
    .join(" ")
}

function normalizeSearchValue(value: string) {
  return normalizeMojibakeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function getColumnLabel<TData, TValue>(
  header: ColumnDef<TData, TValue>["header"],
  fallback: string
) {
  return normalizeMojibakeText(typeof header === "string" ? header : fallback)
}

function getColumnMeta(meta: unknown): DataTableColumnMeta {
  return meta && typeof meta === "object" ? meta : {}
}

function normalizeRenderedContent(content: ReactNode): ReactNode {
  if (typeof content === "string") {
    return normalizeMojibakeText(content)
  }

  if (Array.isArray(content)) {
    return content.map((item) => normalizeRenderedContent(item))
  }

  return content
}

export function DataTable<TData, TValue>({
  actions,
  columns,
  data,
  emptyText = "Sem resultados.",
  initialColumnVisibility = {},
  pageSize = 10,
  pagination = "auto",
  showFooterSummary = true,
}: DataTableProps<TData, TValue>) {
  const [search, setSearch] = useState("")
  const [sorting, setSorting] = useState<SortingState>([])
  const [paginationState, setPaginationState] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  })
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    initialColumnVisibility
  )
  const filteredData = useMemo(() => {
    const query = normalizeSearchValue(search.trim())

    if (!query) {
      return data
    }

    return data.filter((item) =>
      normalizeSearchValue(getSearchableValue(item)).includes(query)
    )
  }, [data, search])
  const paginationEnabled =
    pagination === true ||
    (pagination === "auto" && filteredData.length > paginationState.pageSize)

  useEffect(() => {
    setPaginationState((currentPagination) => ({
      ...currentPagination,
      pageIndex: 0,
      pageSize,
    }))
  }, [pageSize, search])

  // TanStack Table intentionally returns table helpers that are not compiler-memoizable.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel:
      pagination === false ? undefined : getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPaginationState,
    onSortingChange: setSorting,
    state: {
      columnVisibility,
      pagination: paginationState,
      sorting,
    },
  })

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex items-center gap-2">
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Pesquisar..."
          className="max-w-xs"
        />
        <div className="ml-auto flex items-center gap-2">
          {actions}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
              />
            }
          >
            <SlidersHorizontal />
            Filtrar
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {table.getAllLeafColumns().map((column) => (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={column.getIsVisible()}
                disabled={!column.getCanHide()}
                onCheckedChange={(checked) =>
                  column.toggleVisibility(Boolean(checked))
                }
              >
                {getColumnLabel(column.columnDef.header, column.id)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>

      <div className="w-full min-w-0 overflow-x-auto overflow-y-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="-mx-2"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {normalizeRenderedContent(
                            flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )
                          )}
                          {header.column.getIsSorted() === "asc" ? (
                            <ArrowUp />
                          ) : header.column.getIsSorted() === "desc" ? (
                            <ArrowDown />
                          ) : (
                            <ChevronsUpDown />
                          )}
                        </Button>
                      ) : (
                        normalizeRenderedContent(
                          flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )
                        )
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        getColumnMeta(cell.column.columnDef.meta).cellClassName
                      )}
                    >
                      {normalizeRenderedContent(
                        flexRender(cell.column.columnDef.cell, cell.getContext())
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={Math.max(table.getVisibleLeafColumns().length, 1)}
                  className="h-24 text-center"
                >
                  {normalizeMojibakeText(emptyText)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {paginationEnabled ? (
        <div className="flex items-center justify-end gap-2">
          <div className="mr-auto text-xs text-muted-foreground">
            Página {table.getState().pagination.pageIndex + 1} de{" "}
            {table.getPageCount()}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Seguinte
          </Button>
        </div>
      ) : null}

      {showFooterSummary ? (
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{table.getVisibleLeafColumns().length} colunas</span>
          <span>
            {table.getRowModel().rows.length} de {data.length} linhas
          </span>
        </div>
      ) : null}
    </div>
  )
}
