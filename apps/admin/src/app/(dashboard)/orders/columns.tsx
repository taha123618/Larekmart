"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { OrderType } from "@repo/types";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, Truck, ExternalLink, Banknote, CreditCard } from "lucide-react";
import Link from "next/link";

const getCarrierBadge = (carrier?: string | null) => {
  const c = (carrier || "custom").toLowerCase();
  if (c === "tcs") {
    return (
      <span className="font-bold text-[10px] px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
        TCS
      </span>
    );
  }
  if (c === "leopards") {
    return (
      <span className="font-bold text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        LEOPARDS
      </span>
    );
  }
  if (c === "dhl") {
    return (
      <span className="font-bold text-[10px] px-2 py-0.5 rounded bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-300">
        DHL
      </span>
    );
  }
  if (c === "fedex") {
    return (
      <span className="font-bold text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
        FEDEX
      </span>
    );
  }
  return (
    <span className="font-semibold text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
      CUSTOM
    </span>
  );
};

export const columns: ColumnDef<OrderType>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        checked={row.getIsSelected()}
      />
    ),
  },
  {
    accessorKey: "_id",
    header: "Order ID",
    cell: ({ row }) => {
      const id = row.original._id;
      return (
        <span className="font-mono text-xs font-medium">
          {id.slice(-8).toUpperCase()}
        </span>
      );
    },
  },
  {
    accessorKey: "email",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Customer
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const email = row.original.email;
      const addr = row.original.shippingAddress;
      return (
        <div className="flex flex-col">
          <span className="text-xs font-medium">{email}</span>
          {addr?.fullName && (
            <span className="text-[11px] text-muted-foreground">{addr.fullName}</span>
          )}
        </div>
      );
    },
  },
  {
    id: "payment",
    header: "Payment",
    cell: ({ row }) => {
      const order = row.original;
      return order.isCod ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
          <Banknote className="w-3 h-3" />
          COD
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
          <CreditCard className="w-3 h-3" />
          Card
        </span>
      );
    },
  },
  {
    id: "fulfillment",
    header: "Logistics",
    cell: ({ row }) => {
      const order = row.original;
      return (
        <div className="flex items-center gap-1.5 flex-wrap">
          {getCarrierBadge(order.carrier)}
          {order.trackingNumber ? (
            <a
              href={`http://localhost:3002/track?number=${encodeURIComponent(order.trackingNumber)}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
            >
              {order.trackingNumber}
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          ) : (
            <span className="text-[10px] text-muted-foreground italic">
              Pending
            </span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status");

      return (
        <div
          className={cn(
            `p-1 rounded-md w-max text-xs font-semibold capitalize`,
            status === "pending" && "bg-yellow-500/20 text-yellow-700",
            status === "success" && "bg-emerald-500/20 text-emerald-700",
            status === "failed" && "bg-rose-500/20 text-rose-700",
          )}
        >
          {status as string}
        </div>
      );
    },
  },
  {
    accessorKey: "amount",
    header: () => <div className="text-right">Amount</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("amount"));
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount / 100);

      return <div className="text-right font-medium">{formatted}</div>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const order = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(order._id)}
            >
              Copy order ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/shipping?carrier=${order.carrier || "all"}`}>
                <Truck className="w-3.5 h-3.5 mr-2" />
                View in Logistics
              </Link>
            </DropdownMenuItem>
            {order.trackingNumber && (
              <DropdownMenuItem asChild>
                <a
                  href={`http://localhost:3002/track?number=${encodeURIComponent(order.trackingNumber)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-2" />
                  Track Courier
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href={`/users/${order.userId}`}>View customer</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
