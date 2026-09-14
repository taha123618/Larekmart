import { auth } from "@clerk/nextjs/server";
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
import { Sheet, SheetTrigger } from "@/components/ui/sheet";
import RestockSheet from "@/components/RestockSheet";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { InventoryItemData } from "@/components/InventoryDataTable";

export const dynamic = "force-dynamic";

async function fetchLowStock(
  token: string | null,
): Promise<InventoryItemData[]> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_INVENTORY_SERVICE_URL || "http://localhost:8007"}/api/v1/inventory/low-stock?limit=200`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      console.error("Failed to fetch low stock items", res.status);
      return [];
    }
    const json = await res.json();
    return json.data ?? [];
  } catch (error) {
    console.error("Error fetching low stock items:", error);
    return [];
  }
}

export default async function LowStockPage() {
  const { getToken } = await auth();
  const token = await getToken();
  const items = await fetchLowStock(token);

  return (
    <div className="flex flex-col gap-6">
      <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-md">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <h1 className="text-xl font-bold tracking-tight text-amber-900 dark:text-amber-200">
            Low Stock & Out-of-Stock Alerts
          </h1>
        </div>
        <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
          Items below their warehouse reorder point threshold. Quick restock can
          be dispatched directly from this console.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Showing {items.length} critical items
        </span>
        <Button asChild variant="outline" size="sm">
          <Link href="/inventory">← Back to All Inventory</Link>
        </Button>
      </div>

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
              <TableHead className="text-right">Reorder Threshold</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="h-32 text-center text-muted-foreground"
                >
                  🎉 Great news! No items are currently low in stock or out of
                  stock.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
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
                  <TableCell className="text-right font-bold text-rose-600 dark:text-rose-400">
                    {item.availableQuantity}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {item.reservedQuantity}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {item.soldQuantity}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-amber-600">
                    ≤ {item.reorderPoint}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.status === "OUT_OF_STOCK" ? (
                      <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30">
                        Out of Stock
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                        Low Stock
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button size="sm" className="h-7 px-3 text-xs gap-1">
                          Restock Now
                        </Button>
                      </SheetTrigger>
                      <RestockSheet
                        defaultValues={{
                          productId: item.productId,
                          variantId: item.variantId,
                          warehouseId: item.warehouseId,
                        }}
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
