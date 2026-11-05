import { db, pool } from "./connection.js";
import {
  sellers,
  sellerStores,
  sellerStaff,
  sellerSettings,
  sellerPolicies,
  sellerStatusHistory,
} from "./schema.js";
import { eq } from "drizzle-orm";

export async function seedSellers(): Promise<void> {
  console.log("Seeding sellers and stores into larekmart_seller_db...");

  const seedData = [
    {
      seller: {
        id: "seller_marketplace_42",
        vendorId: "vendor_marketplace_42",
        primaryUserId: "user_seller_apex_01",
        status: "ACTIVE",
      },
      store: {
        id: "store_apex_outfitter",
        sellerId: "seller_marketplace_42",
        name: "Apex Outfitter Official Store",
        slug: "apex-outfitter",
        headline: "Premium outdoor and athletic footwear",
        description:
          "Official Larekmart flagship store for trail boots, running essentials, and outdoor gear.",
        status: "ACTIVE",
        vacationMode: false,
      },
      staff: {
        id: "staff_apex_01",
        sellerId: "seller_marketplace_42",
        userId: "user_seller_apex_01",
        email: "tariq@apexoutfitter.example.com",
        name: "Tariq Mahmood",
        role: "OWNER",
        status: "ACTIVE",
        permissions: ["MANAGE_STORE", "MANAGE_PRODUCTS", "MANAGE_ORDERS", "VIEW_FINANCES"],
      },
      settings: {
        id: "settings_apex_01",
        sellerId: "seller_marketplace_42",
        defaultCurrency: "USD",
        shippingOriginPostalCode: "75400",
        autoAcceptOrders: true,
        lowStockThreshold: 5,
        supportEmail: "support@apexoutfitter.example.com",
        supportPhone: "+92-300-1234567",
      },
      policies: [
        {
          id: "policy_apex_shipping_01",
          sellerId: "seller_marketplace_42",
          policyType: "SHIPPING",
          title: "Apex Express Shipping Policy",
          content: "Orders ship within 24-48 business hours with verified real-time tracking.",
        },
        {
          id: "policy_apex_returns_02",
          sellerId: "seller_marketplace_42",
          policyType: "RETURNS",
          title: "30-Day Footwear Satisfaction Guarantee",
          content: "Full refund or replacement on unworn items returned in original packaging within 30 days.",
        },
      ],
      history: {
        id: "history_apex_01",
        sellerId: "seller_marketplace_42",
        previousStatus: "ONBOARDING",
        newStatus: "ACTIVE",
        reason: "Completed onboarding and KYB verification.",
        changedByUserId: "admin_super_user",
      },
    },
    {
      seller: {
        id: "seller_test_901",
        vendorId: "vendor_test_901",
        primaryUserId: "user_seller_urban_02",
        status: "ACTIVE",
      },
      store: {
        id: "store_urban_threads",
        sellerId: "seller_test_901",
        name: "Urban Threads Flagship",
        slug: "urban-threads",
        headline: "Modern streetwear and casual apparel",
        description:
          "Curated urban aesthetics, minimalist sneakers, and premium hoodies.",
        status: "ACTIVE",
        vacationMode: false,
      },
      staff: {
        id: "staff_urban_01",
        sellerId: "seller_test_901",
        userId: "user_seller_urban_02",
        email: "sarah@urbanthreads.example.com",
        name: "Sarah Connor",
        role: "OWNER",
        status: "ACTIVE",
        permissions: ["MANAGE_STORE", "MANAGE_PRODUCTS", "MANAGE_ORDERS"],
      },
      settings: {
        id: "settings_urban_01",
        sellerId: "seller_test_901",
        defaultCurrency: "USD",
        shippingOriginPostalCode: "97477",
        autoAcceptOrders: true,
        lowStockThreshold: 10,
        supportEmail: "hello@urbanthreads.example.com",
        supportPhone: "+1-800-555-0199",
      },
      policies: [
        {
          id: "policy_urban_shipping_01",
          sellerId: "seller_test_901",
          policyType: "SHIPPING",
          title: "Urban Standard Domestic Delivery",
          content: "Standard ground delivery within 3-5 business days across the continental US.",
        },
      ],
      history: {
        id: "history_urban_01",
        sellerId: "seller_test_901",
        previousStatus: "ONBOARDING",
        newStatus: "ACTIVE",
        reason: "Initial marketplace verification approved.",
        changedByUserId: "admin_super_user",
      },
    },
  ];

  for (const item of seedData) {
    const existing = await db
      .select({ id: sellers.id })
      .from(sellers)
      .where(eq(sellers.id, item.seller.id))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(sellers).values(item.seller);
      await db.insert(sellerStores).values(item.store);
      await db.insert(sellerStaff).values(item.staff);
      await db.insert(sellerSettings).values(item.settings);
      for (const policy of item.policies) {
        await db.insert(sellerPolicies).values(policy);
      }
      await db.insert(sellerStatusHistory).values(item.history);
      console.log(`  ✓ Seeded seller & store: ${item.store.name} (${item.seller.id})`);
    } else {
      console.log(`  ℹ Seller already exists: ${item.seller.id}`);
    }
  }

  console.log("Seller seeding completed successfully.");
}

if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js")) {
  seedSellers()
    .catch((err) => {
      console.error("Seller seed failed:", err);
      process.exit(1);
    })
    .finally(() => pool.end());
}

