"use client";

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetTrigger } from "@/components/ui/sheet";
import RestockSheet from "./RestockSheet";
import AdjustSheet from "./AdjustSheet";
import AddInventoryItemSheet from "./AddInventoryItemSheet";
import { Plus, Clock } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";

export interface InventoryItemData {
  id: string;
  productId: number;
  variantId: string;
  warehouseId: string;
  quantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  soldQuantity: number;
  reorderPoint: number;
  status: "ACTIVE" | "LOW_STOCK" | "OUT_OF_STOCK" | "INACTIVE";
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface InventoryDataTableProps {
  initialItems: InventoryItemData[];
}

export default function InventoryDataTable({
  initialItems,
}: InventoryDataTableProps) {
  const [items, setItems] = useState<InventoryItemData[]>(initialItems);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isSweeping, setIsSweeping] = useState(false);
  const { getToken } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const handleSweepStale = async () => {
    setIsSweeping(true);
    try {
      const token = await getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_INVENTORY_SERVICE_URL || process.env.NEXT_PUBLIC_API_GATEWAY_URL || "http://localhost:8090"}/api/v1/inventory/reservations/expire-stale`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await res.json();
      if (res.ok) {
        toast.success(`Swept ${data.count ?? 0} expired reservations!`);
        router.refresh();
      } else {
        toast.error(data.message || "Failed to sweep stale reservations");
      }
    } catch {
      toast.error("Error sweeping stale reservations");
    } finally {
      setIsSweeping(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.productId.toString().includes(searchTerm) ||
      item.variantId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.warehouseId.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" || item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
            Active
          </Badge>
        );
      case "LOW_STOCK":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
            Low Stock
          </Badge>
        );
      case "OUT_OF_STOCK":
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30">
            Out of Stock
          </Badge>
        );
      default:
        return <Badge variant="outline">Inactive</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 items-center gap-2 max-w-sm">
          <Input
            placeholder="Search by product, variant, or warehouse..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="LOW_STOCK">Low Stock</SelectItem>
              <SelectItem value="OUT_OF_STOCK">Out of Stock</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSweepStale}
            disabled={isSweeping}
            className="h-9 gap-1.5"
          >
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            {isSweeping ? "Sweeping..." : "Sweep Expired"}
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button size="sm" className="h-9 gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Initialize Stock
              </Button>
            </SheetTrigger>
            <AddInventoryItemSheet onSuccess={() => router.refresh()} />
          </Sheet>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Product ID</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Reserved</TableHead>
              <TableHead className="text-right">Sold</TableHead>
              <TableHead className="text-right">Total On Hand</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="h-32 text-center text-muted-foreground"
                >
                  No inventory records found.
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs font-semibold">
                    #{item.productId}
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    {item.variantId}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {item.warehouseId}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                    {item.availableQuantity}
                  </TableCell>
                  <TableCell className="text-right text-blue-600 dark:text-blue-400">
                    {item.reservedQuantity}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {item.soldQuantity}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {item.quantity}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(item.status)}
                  </TableCell>
                  <TableCell className="text-right space-x-1.5">
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                        >
                          Restock
                        </Button>
                      </SheetTrigger>
                      <RestockSheet
                        defaultValues={{
                          productId: item.productId,
                          variantId: item.variantId,
                          warehouseId: item.warehouseId,
                        }}
                        onSuccess={() => router.refresh()}
                      />
                    </Sheet>

                    <Sheet>
                      <SheetTrigger asChild>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-7 px-2 text-xs"
                        >
                          Adjust
                        </Button>
                      </SheetTrigger>
                      <AdjustSheet
                        defaultValues={{
                          productId: item.productId,
                          variantId: item.variantId,
                          warehouseId: item.warehouseId,
                        }}
                        onSuccess={() => router.refresh()}
                      />
                    </Sheet>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
