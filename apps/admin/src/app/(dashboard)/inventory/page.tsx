import { auth } from "@clerk/nextjs/server";
import InventoryStatsCards from "@/components/InventoryStatsCards";
import InventoryDataTable, {
  InventoryItemData,
} from "@/components/InventoryDataTable";

export const dynamic = "force-dynamic";

async function fetchInventory(
  token: string | null,
): Promise<InventoryItemData[]> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_INVENTORY_SERVICE_URL || process.env.NEXT_PUBLIC_API_GATEWAY_URL || "http://localhost:8090"}/api/v1/inventory/items?limit=500`,
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
  const items = await fetchInventory(token);

  const totalItems = items.length;
  const availableUnits = items.reduce(
    (acc, item) => acc + item.availableQuantity,
    0,
  );
  const reservedUnits = items.reduce(
    (acc, item) => acc + item.reservedQuantity,
    0,
  );
  const soldUnits = items.reduce((acc, item) => acc + item.soldQuantity, 0);
  const lowStockCount = items.filter(
    (item) => item.status === "LOW_STOCK" || item.status === "OUT_OF_STOCK",
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="px-4 py-3 bg-secondary rounded-md">
        <h1 className="text-xl font-bold tracking-tight">
          Stock & Warehouse Inventory
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Real-time stock management with PostgreSQL source of truth, atomic
          checkout reservation locking, and full audit movements.
        </p>
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
