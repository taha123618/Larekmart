import { prisma } from "./client.js";
import {
  WarehouseStatus,
  InventoryItemStatus,
} from "../generated/prisma/index.js";

export async function seedInventory(): Promise<void> {
  console.log("[Inventory Seed] Starting inventory database seeding...");

  // 1. Ensure main warehouse exists
  const warehouse = await prisma.warehouse.upsert({
    where: { code: "MAIN-WH" },
    update: { status: WarehouseStatus.ACTIVE },
    create: {
      id: "main-warehouse",
      code: "MAIN-WH",
      name: "Main Fulfillment Center",
      status: WarehouseStatus.ACTIVE,
      address: "Karachi Hub, Logistics Avenue",
    },
  });

  console.log(
    `[Inventory Seed] Warehouse confirmed: ${warehouse.name} (${warehouse.id})`,
  );

  // 2. Base catalog products and their variants
  const products = [
    {
      id: 101,
      sizes: ["40", "41", "42", "43"],
      colors: ["red", "white", "blue"],
    },
    {
      id: 102,
      sizes: ["40", "41", "42", "43", "44"],
      colors: ["black", "brown"],
    },
    {
      id: 103,
      sizes: ["39", "40", "41", "42"],
      colors: ["black", "gray"],
    },
    {
      id: 1,
      sizes: ["s", "m", "l", "xl"],
      colors: ["gray", "purple", "green"],
    },
    {
      id: 2,
      sizes: ["s", "m", "l", "xl"],
      colors: ["black", "navy"],
    },
    {
      id: 3,
      sizes: ["s", "m", "l", "xl"],
      colors: ["black", "gray"],
    },
    {
      id: 4,
      sizes: ["s", "m", "l", "xl"],
      colors: ["white", "black"],
    },
    {
      id: 5,
      sizes: ["s", "m", "l", "xl"],
      colors: ["navy", "black"],
    },
    {
      id: 6,
      sizes: ["40", "41", "42", "43", "44"],
      colors: ["black", "white"],
    },
  ];

  let totalItems = 0;

  for (const prod of products) {
    // Also create base product item (variantId: "default")
    await prisma.inventoryItem.upsert({
      where: {
        productId_variantId_warehouseId: {
          productId: prod.id,
          variantId: "default",
          warehouseId: warehouse.id,
        },
      },
      update: {
        quantity: 100,
        availableQuantity: 100,
        status: InventoryItemStatus.ACTIVE,
      },
      create: {
        productId: prod.id,
        variantId: "default",
        warehouseId: warehouse.id,
        quantity: 100,
        availableQuantity: 100,
        reservedQuantity: 0,
        soldQuantity: 0,
        reorderPoint: 10,
        status: InventoryItemStatus.ACTIVE,
      },
    });
    totalItems++;

    for (const size of prod.sizes) {
      for (const color of prod.colors) {
        const variantId = `${prod.id}-${size}-${color}`;
        await prisma.inventoryItem.upsert({
          where: {
            productId_variantId_warehouseId: {
              productId: prod.id,
              variantId,
              warehouseId: warehouse.id,
            },
          },
          update: {
            quantity: 50,
            availableQuantity: 50,
            status: InventoryItemStatus.ACTIVE,
          },
          create: {
            productId: prod.id,
            variantId,
            warehouseId: warehouse.id,
            quantity: 50,
            availableQuantity: 50,
            reservedQuantity: 0,
            soldQuantity: 0,
            reorderPoint: 5,
            status: InventoryItemStatus.ACTIVE,
          },
        });
        totalItems++;
      }
    }
  }

  console.log(
    `[Inventory Seed] Finished seeding ${totalItems} inventory items.`,
  );
}

seedInventory()
  .catch((err) => {
    console.error("[Inventory Seed] Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
