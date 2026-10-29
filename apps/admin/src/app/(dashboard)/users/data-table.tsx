"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
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
import { useState, useMemo } from "react";
import { Trash2, Search, Store, Users, UserCheck } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useMutation } from "@tanstack/react-query";
import { getApiGatewayUrl } from "@/services/gateway.service";
import { User } from "@clerk/nextjs/server";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

export function DataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState({});
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "SELLER" | "BUYER">(
    "ALL",
  );

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const u = item as Record<string, unknown> & {
        isSeller?: boolean;
        firstName?: string | null;
        lastName?: string | null;
        username?: string | null;
        emailAddresses?: Array<{ emailAddress?: string }>;
      };

      if (roleFilter === "SELLER" && !u.isSeller) return false;
      if (roleFilter === "BUYER" && u.isSeller) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const fullName =
          `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase();
        const email = u.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
        const username = (u.username || "").toLowerCase();
        if (
          !fullName.includes(q) &&
          !email.includes(q) &&
          !username.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [data, roleFilter, search]);

  const sellerCount = useMemo(
    () =>
      data.filter((u) => Boolean((u as { isSeller?: boolean }).isSeller))
        .length,
    [data],
  );
  const buyerCount = data.length - sellerCount;

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      rowSelection,
    },
  });

  const { getToken } = useAuth();
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const selectedRows = table.getSelectedRowModel().rows;

      await Promise.all(
        selectedRows.map(async (row) => {
          const userId = (row.original as User).id;
          const authUrl = getApiGatewayUrl();
          await fetch(`${authUrl}/api/v1/users/${userId}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        }),
      );
    },
    onSuccess: () => {
      toast.success("User(s) deleted successfully");
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <div className="space-y-4">
      {/* FILTER & SEARCH TOOLBAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border border-border">
        {/* Role Filters (All / Sellers / Buyers) */}
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-md">
          <Button
            type="button"
            variant={roleFilter === "ALL" ? "default" : "ghost"}
            size="sm"
            className="text-xs h-7 px-2.5 font-medium"
            onClick={() => setRoleFilter("ALL")}
          >
            <Users className="w-3.5 h-3.5 mr-1" />
            All ({data.length})
          </Button>
          <Button
            type="button"
            variant={roleFilter === "SELLER" ? "default" : "ghost"}
            size="sm"
            className="text-xs h-7 px-2.5 font-medium"
            onClick={() => setRoleFilter("SELLER")}
          >
            <Store className="w-3.5 h-3.5 mr-1 text-indigo-500" />
            Verified Sellers ({sellerCount})
          </Button>
          <Button
            type="button"
            variant={roleFilter === "BUYER" ? "default" : "ghost"}
            size="sm"
            className="text-xs h-7 px-2.5 font-medium"
            onClick={() => setRoleFilter("BUYER")}
          >
            <UserCheck className="w-3.5 h-3.5 mr-1 text-emerald-500" />
            Buyers Only ({buyerCount})
          </Button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs"
          />
        </div>
      </div>

      <div className="rounded-md border">
        {Object.keys(rowSelection).length > 0 && (
          <div className="flex justify-end">
            <button
              className="flex items-center gap-2 bg-red-500 text-white px-2 py-1 text-sm rounded-md m-4 cursor-pointer"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              <Trash2 className="w-4 h-4" />
              {mutation.isPending ? "Deleting" : "Delete User(s)"}
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
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
