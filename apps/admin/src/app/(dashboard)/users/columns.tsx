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
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import MediaImage from "@/components/MediaImage";

export interface UserWithServiceStatus {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  imageUrl?: string | null;
  emailAddresses: Array<{ emailAddress: string; [key: string]: unknown }>;
  banned?: boolean;
  userServiceStatus?: string | null;
  phone?: string | null;
  [key: string]: unknown;
}

export const columns: ColumnDef<UserWithServiceStatus>[] = [
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
    accessorKey: "avatar",
    header: "Avatar",
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div className="w-9 h-9 relative flex items-center justify-center">
          <MediaImage
            ref_={user.imageUrl || undefined}
            alt={user.firstName || user.username || "-"}
            size={36}
            className="w-9 h-9 rounded-full object-cover"
          />
        </div>
      );
    },
  },
  {
    accessorKey: "firstName",
    header: "User",
    cell: ({ row }) => {
      const user = row.original;
      return <div className="">{user.firstName || user.username || "-"}</div>;
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
          Email
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const user = row.original;
      return <div className="">{user.emailAddresses[0]?.emailAddress}</div>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const user = row.original;
      const status =
        user.userServiceStatus || (user.banned ? "banned" : "active");

      return (
        <div
          className={cn(
            `px-2 py-0.5 rounded-md w-max text-xs font-semibold uppercase`,
            (status === "active" || status === "ACTIVE") &&
              "bg-green-500/20 text-green-700 dark:text-green-300",
            (status === "banned" ||
              status === "SUSPENDED" ||
              status === "DEACTIVATED") &&
              "bg-red-500/20 text-red-700 dark:text-red-300",
            status === "PENDING_VERIFICATION" &&
              "bg-amber-500/20 text-amber-700 dark:text-amber-300",
          )}
        >
          {String(status)}
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const user = row.original;

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
              onClick={() => navigator.clipboard.writeText(user.id)}
            >
              Copy user ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Link href={`/users/${user.id}`}>View customer</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
