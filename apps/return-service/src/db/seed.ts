import { v4 as uuidv4 } from "uuid";
import { getDb } from "./connection.js";
import { returnPolicyVersions, returnReasons } from "./schema.js";

export async function seedDatabase(): Promise<void> {
  const db = getDb();
  console.log("Seeding return-service initial reasons and policy versions...");

  // 1. Seed return reasons
  const reasons = [
    {
      id: "DAMAGED_TRANSIT",
      title: "Damaged in Transit",
      description: "Item package or product was broken/damaged upon delivery",
      requiresEvidence: true,
      isSellerFault: true,
      isActive: true,
    },
    {
      id: "DEFECTIVE",
      title: "Defective or Not Working",
      description: "Product is malfunctioning, dead on arrival, or incomplete",
      requiresEvidence: true,
      isSellerFault: true,
      isActive: true,
    },
    {
      id: "WRONG_ITEM",
      title: "Wrong Item Received",
      description: "Delivered product differs from the purchased item/variant",
      requiresEvidence: true,
      isSellerFault: true,
      isActive: true,
    },
    {
      id: "NOT_AS_DESCRIBED",
      title: "Not as Described",
      description:
        "Product materially deviates from website images and specifications",
      requiresEvidence: true,
      isSellerFault: true,
      isActive: true,
    },
    {
      id: "CHANGED_MIND",
      title: "Changed Mind / Unwanted",
      description:
        "Customer no longer needs the product (standard return window)",
      requiresEvidence: false,
      isSellerFault: false,
      isActive: true,
    },
    {
      id: "SIZE_MISMATCH",
      title: "Size / Fit Mismatch",
      description: "Apparel or footwear does not fit as expected",
      requiresEvidence: false,
      isSellerFault: false,
      isActive: true,
    },
    {
      id: "ARRIVED_LATE",
      title: "Arrived Too Late",
      description: "Shipment missed guaranteed delivery timeframe",
      requiresEvidence: false,
      isSellerFault: true,
      isActive: true,
    },
    {
      id: "OTHER",
      title: "Other Reason",
      description: "Specific reason noted in customer comments",
      requiresEvidence: false,
      isSellerFault: false,
      isActive: true,
    },
  ];

  for (const reason of reasons) {
    await db
      .insert(returnReasons)
      .values(reason)
      .onDuplicateKeyUpdate({
        set: { title: reason.title, isSellerFault: reason.isSellerFault },
      });
  }

  // 2. Seed default 14-day policy version
  await db
    .insert(returnPolicyVersions)
    .values({
      id: uuidv4(),
      version: "1.0.0",
      returnWindowDays: 14,
      warrantyGraceDays: 30,
      restockingFeePercentage: "0.00",
      requiresReceipt: true,
      isActive: true,
    })
    .onDuplicateKeyUpdate({ set: { returnWindowDays: 14 } });

  console.log("return-service seed completed successfully.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seeding failed:", err);
      process.exit(1);
    });
}
