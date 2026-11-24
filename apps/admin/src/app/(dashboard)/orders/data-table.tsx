"use client";

import {
  flexRender,
  useTable,
  stockFeatures,
  createSortedRowModel,
  createPaginatedRowModel,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
  type RowData,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/TablePagination";
import { useState } from "react";
import { Trash2 } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface DataTableProps<TData extends RowData = any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<any, TData>[];
  data: TData[];
}

const tableFeatures = {
  ...stockFeatures,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DataTable<TData extends RowData = any>({
  columns,
  data,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const table = useTable(
    {
      features: tableFeatures,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      columns: columns as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onSortingChange: setSorting as any,
      onRowSelectionChange: setRowSelection,
      state: {
        sorting,
        rowSelection,
      },
    },
    (state) => state,
  );

  return (
    <div className="rounded-xl border border-border/60 bg-card text-card-foreground shadow-xs overflow-hidden">
      {Object.keys(rowSelection).length > 0 && (
        <div className="flex justify-end p-3 border-b border-border/40">
          <button className="flex items-center gap-2 bg-destructive text-destructive-foreground px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer hover:bg-destructive/90 transition shadow-xs">
            <Trash2 className="w-3.5 h-3.5" />
            Delete Payment(s)
          </button>
        </div>
      )}
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                );
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
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <DataTablePagination table={table} />
    </div>
  );
}
