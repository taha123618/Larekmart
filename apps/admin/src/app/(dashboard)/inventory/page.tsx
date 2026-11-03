import { auth } from "@clerk/nextjs/server";
import InventoryStatsCards from "@/components/InventoryStatsCards";
import InventoryDataTable, {
  InventoryItemData,
} from "@/components/InventoryDataTable";
import { getApiGatewayUrl } from "@/services/gateway.service";
import { fetchOperationsAnalytics } from "@/services/analytics.service";
import { Activity } from "lucide-react";

export const dynamic = "force-dynamic";

async function fetchInventory(
  token: string | null,
): Promise<InventoryItemData[]> {
  try {
    const inventoryUrl = getApiGatewayUrl();
    const res = await fetch(
      `${inventoryUrl}/api/v1/inventory/items?limit=500`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      console.error("Failed to fetch inventory items", res.status);
      return [];
    }
    const json = await res.json();
    return json.data ?? [];
  } catch (error) {
    console.error("Error fetching inventory items:", error);
    return [];
  }
}

export default async function InventoryPage() {
  const { getToken } = await auth();
  const token = await getToken();

  const [items, operations] = await Promise.all([
    fetchInventory(token),
    fetchOperationsAnalytics(token),
  ]);

  const totalItems = items.length;
  const availableUnits = items.reduce(
    (acc, item) => acc + item.availableQuantity,
    0,
  );
  const reservedUnits = items.reduce(
    (acc, item) => acc + item.reservedQuantity,
    0,
  );
  const soldUnits =
    operations?.totalStockSold ??
    items.reduce((acc, item) => acc + item.soldQuantity, 0);
  const lowStockCount =
    operations?.totalLowStockAlerts ??
    items.filter(
      (item) => item.status === "LOW_STOCK" || item.status === "OUT_OF_STOCK",
    ).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between px-4 py-3 bg-secondary rounded-md">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Stock & Warehouse Inventory
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time stock management with PostgreSQL source of truth and Kafka
            telemetry.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 font-medium">
          <Activity className="h-3.5 w-3.5 animate-pulse text-emerald-500" />
          <span>Analytic Sync Active</span>
        </div>
      </div>

      <InventoryStatsCards
        totalItems={totalItems}
        availableUnits={availableUnits}
        reservedUnits={reservedUnits}
        soldUnits={soldUnits}
        lowStockCount={lowStockCount}
      />

      <InventoryDataTable initialItems={items} />
    </div>
  );
}
