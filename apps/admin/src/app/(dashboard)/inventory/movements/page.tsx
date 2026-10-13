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
import { History, ArrowUpRight, ShieldAlert } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface MovementRecord {
  id: string;
  inventoryItemId: string;
  type:
    | "PURCHASE"
    | "RESTOCK"
    | "RESERVE"
    | "RELEASE"
    | "SALE"
    | "RETURN"
    | "ADJUSTMENT"
    | "DAMAGE";
  quantity: number;
  referenceType?: string | null;
  referenceId?: string | null;
  reason?: string | null;
  createdAt: string;
  inventoryItem?: {
    productId: number;
    variantId: string;
    warehouseId: string;
  };
}

async function fetchMovements(token: string | null): Promise<MovementRecord[]> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_INVENTORY_SERVICE_URL || process.env.NEXT_PUBLIC_API_GATEWAY_URL || "http://localhost:8090"}/api/v1/inventory/movements?limit=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      console.error("Failed to fetch inventory movements", res.status);
      return [];
    }
    const json = await res.json();
    return json.data ?? [];
  } catch (error) {
    console.error("Error fetching inventory movements:", error);
    return [];
  }
}

export default async function MovementsPage() {
  const { getToken } = await auth();
  const token = await getToken();
  const movements = await fetchMovements(token);

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "PURCHASE":
      case "RESTOCK":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1">
            <ArrowUpRight className="h-3 w-3" /> {type}
          </Badge>
        );
      case "SALE":
        return (
          <Badge className="bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30 gap-1">
            {type}
          </Badge>
        );
      case "RESERVE":
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30">
            {type}
          </Badge>
        );
      case "RELEASE":
      case "RETURN":
        return (
          <Badge className="bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30">
            {type}
          </Badge>
        );
      case "DAMAGE":
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 gap-1">
            <ShieldAlert className="h-3 w-3" /> {type}
          </Badge>
        );
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="px-4 py-3 bg-secondary rounded-md">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold tracking-tight">
            Inventory Movement Audit Ledger
          </h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Append-only transactional ledger recording every stock movement:
          reservations, checkouts, sales, restocks, and damage adjustments.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Showing latest {movements.length} ledger entries
        </span>
        <Button asChild variant="outline" size="sm">
          <Link href="/inventory">← Back to Stock</Link>
        </Button>
      </div>

      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Movement ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Product / Variant</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Reason / Notes</TableHead>
              <TableHead className="text-right">Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-32 text-center text-muted-foreground"
                >
                  No movement records found.
                </TableCell>
              </TableRow>
            ) : (
              movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {movement.id.slice(-8)}
                  </TableCell>
                  <TableCell>{getTypeBadge(movement.type)}</TableCell>
                  <TableCell className="font-medium text-sm">
                    {movement.inventoryItem ? (
                      <>
                        <span className="font-mono text-xs">
                          #{movement.inventoryItem.productId}
                        </span>{" "}
                        ({movement.inventoryItem.variantId})
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {movement.inventoryItem?.warehouseId ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {movement.quantity}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {movement.referenceType && movement.referenceId
                      ? `${movement.referenceType}: ${movement.referenceId.slice(0, 12)}...`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs max-w-xs truncate">
                    {movement.reason || "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {new Date(movement.createdAt).toLocaleString()}
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
