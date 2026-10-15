import { db, pool } from "./connection.js";
import {
  promotions,
  promotionRules,
  promotionTargets,
  couponCodes,
  promotionBudgets,
  promotionAuditLogs,
} from "./schema.js";

export async function seedPromotionData(): Promise<void> {
  console.log("Seeding initial promotion data into larekmart_promotion_db...");

  const now = new Date();
  const pastSevenDays = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const futureYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const futureSixMonths = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
  const futureTwoMonths = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  // 1. Welcome 10% Off
  console.log("  → Seeding WELCOME10 promotion...");
  const [welcomePromo] = await db
    .insert(promotions)
    .values({
      name: "Welcome First Order Discount",
      description: "10% off your first purchase on Larekmart (min $30 order)",
      type: "PERCENTAGE",
      discountValue: "10.00",
      maxDiscountAmount: "50.00",
      status: "ACTIVE",
      priority: 10,
      isStackable: false,
      startDate: pastSevenDays,
      endDate: futureYear,
    })
    .returning();

  if (welcomePromo) {
    await db.insert(promotionRules).values({
      promotionId: welcomePromo.id,
      minOrderAmount: "30.00",
      customerSegment: "FIRST_TIME",
      maxPerCustomer: 1,
      globalLimit: 5000,
      usageCount: 0,
    });

    await db.insert(promotionTargets).values({
      promotionId: welcomePromo.id,
      targetType: "ORDER",
      targetId: null,
      ruleType: "INCLUDE",
    });

    await db.insert(couponCodes).values({
      promotionId: welcomePromo.id,
      code: "WELCOME10",
      maxRedemptions: 5000,
      redemptionsCount: 0,
      isActive: true,
      expiresAt: futureYear,
    });

    await db.insert(promotionBudgets).values({
      promotionId: welcomePromo.id,
      totalBudget: "25000.00",
      reservedAmount: "0.00",
      spentAmount: "0.00",
      currency: "USD",
    });

    await db.insert(promotionAuditLogs).values({
      entityType: "PROMOTION",
      entityId: welcomePromo.id,
      action: "CREATED",
      performedBy: "system_seeder",
      metadata: { code: "WELCOME10", type: "PERCENTAGE" },
    });
  }

  // 2. Summer 20% Sale
  console.log("  → Seeding SUMMER20 promotion...");
  const [summerPromo] = await db
    .insert(promotions)
    .values({
      name: "Summer Mega Savings Event",
      description: "20% off all orders over $50",
      type: "PERCENTAGE",
      discountValue: "20.00",
      maxDiscountAmount: "100.00",
      status: "ACTIVE",
      priority: 20,
      isStackable: false,
      startDate: pastSevenDays,
      endDate: futureTwoMonths,
    })
    .returning();

  if (summerPromo) {
    await db.insert(promotionRules).values({
      promotionId: summerPromo.id,
      minOrderAmount: "50.00",
      customerSegment: "ALL",
      maxPerCustomer: 3,
      globalLimit: 2000,
      usageCount: 0,
    });

    await db.insert(promotionTargets).values({
      promotionId: summerPromo.id,
      targetType: "ORDER",
      targetId: null,
      ruleType: "INCLUDE",
    });

    await db.insert(couponCodes).values({
      promotionId: summerPromo.id,
      code: "SUMMER20",
      maxRedemptions: 2000,
      redemptionsCount: 0,
      isActive: true,
      expiresAt: futureTwoMonths,
    });

    await db.insert(promotionBudgets).values({
      promotionId: summerPromo.id,
      totalBudget: "50000.00",
      reservedAmount: "0.00",
      spentAmount: "0.00",
      currency: "USD",
    });

    await db.insert(promotionAuditLogs).values({
      entityType: "PROMOTION",
      entityId: summerPromo.id,
      action: "CREATED",
      performedBy: "system_seeder",
      metadata: { code: "SUMMER20", type: "PERCENTAGE" },
    });
  }

  // 3. Flat $15 Off
  console.log("  → Seeding SAVE15 promotion...");
  const [save15Promo] = await db
    .insert(promotions)
    .values({
      name: "Flash $15 Instant Savings",
      description: "Take $15 off any eligible purchase over $75",
      type: "FIXED_AMOUNT",
      discountValue: "15.00",
      maxDiscountAmount: "15.00",
      status: "ACTIVE",
      priority: 5,
      isStackable: true,
      startDate: pastSevenDays,
      endDate: futureSixMonths,
    })
    .returning();

  if (save15Promo) {
    await db.insert(promotionRules).values({
      promotionId: save15Promo.id,
      minOrderAmount: "75.00",
      customerSegment: "ALL",
      maxPerCustomer: 2,
      globalLimit: 1000,
      usageCount: 0,
    });

    await db.insert(promotionTargets).values({
      promotionId: save15Promo.id,
      targetType: "ORDER",
      targetId: null,
      ruleType: "INCLUDE",
    });

    await db.insert(couponCodes).values({
      promotionId: save15Promo.id,
      code: "SAVE15",
      maxRedemptions: 1000,
      redemptionsCount: 0,
      isActive: true,
      expiresAt: futureSixMonths,
    });

    await db.insert(promotionBudgets).values({
      promotionId: save15Promo.id,
      totalBudget: "15000.00",
      reservedAmount: "0.00",
      spentAmount: "0.00",
      currency: "USD",
    });

    await db.insert(promotionAuditLogs).values({
      entityType: "PROMOTION",
      entityId: save15Promo.id,
      action: "CREATED",
      performedBy: "system_seeder",
      metadata: { code: "SAVE15", type: "FIXED_AMOUNT" },
    });
  }

  // 4. Free Shipping Coupon
  console.log("  → Seeding FREESHIP promotion...");
  const [freeShipPromo] = await db
    .insert(promotions)
    .values({
      name: "Free Standard Shipping",
      description: "Free shipping for orders over $25",
      type: "FREE_SHIPPING",
      discountValue: "10.00",
      maxDiscountAmount: "15.00",
      status: "ACTIVE",
      priority: 1,
      isStackable: true,
      startDate: pastSevenDays,
      endDate: futureYear,
    })
    .returning();

  if (freeShipPromo) {
    await db.insert(promotionRules).values({
      promotionId: freeShipPromo.id,
      minOrderAmount: "25.00",
      customerSegment: "ALL",
      maxPerCustomer: 5,
      globalLimit: 10000,
      usageCount: 0,
    });

    await db.insert(promotionTargets).values({
      promotionId: freeShipPromo.id,
      targetType: "ORDER",
      targetId: null,
      ruleType: "INCLUDE",
    });

    await db.insert(couponCodes).values({
      promotionId: freeShipPromo.id,
      code: "FREESHIP",
      maxRedemptions: 10000,
      redemptionsCount: 0,
      isActive: true,
      expiresAt: futureYear,
    });

    await db.insert(promotionBudgets).values({
      promotionId: freeShipPromo.id,
      totalBudget: "30000.00",
      reservedAmount: "0.00",
      spentAmount: "0.00",
      currency: "USD",
    });

    await db.insert(promotionAuditLogs).values({
      entityType: "PROMOTION",
      entityId: freeShipPromo.id,
      action: "CREATED",
      performedBy: "system_seeder",
      metadata: { code: "FREESHIP", type: "FREE_SHIPPING" },
    });
  }

  console.log("Promotion seeding completed successfully!");
}

if (
  process.argv[1]?.endsWith("seed.ts") ||
  process.argv[1]?.endsWith("seed.js")
) {
  seedPromotionData()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("Seeding failed:", err);
      await pool.end();
      process.exit(1);
    });
}
