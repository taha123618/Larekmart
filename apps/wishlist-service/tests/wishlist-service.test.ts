import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import {
  CreateWishlistSchema,
  UpdateWishlistSchema,
  AddWishlistItemSchema,
  MoveWishlistItemSchema,
  MergeWishlistSchema,
  CreateShareTokenSchema,
  BulkRemoveItemsSchema,
  WishlistQuerySchema,
  GATEWAY_HEADERS,
} from "@repo/types";

async function runTests() {
  console.log("==========================================");
  console.log("   WISHLIST SERVICE TEST SUITE RUNNER");
  console.log("==========================================\n");

  const app = await buildApp();

  // ────────────────────────────────────────────────────────────
  // Test 1: Health & Readiness Endpoints
  // ────────────────────────────────────────────────────────────
  console.log("[Test 1] Health & Readiness Endpoints");
  const healthRes = await app.inject({
    method: "GET",
    url: "/health",
  });
  assert.ok(
    [200, 503].includes(healthRes.statusCode),
    "Expected /health response",
  );
  const healthJson = JSON.parse(healthRes.payload);
  assert.equal(healthJson.service, "wishlist-service");
  console.log("✓ /health endpoint verified");

  const readyRes = await app.inject({
    method: "GET",
    url: "/ready",
  });
  assert.ok(
    [200, 503].includes(readyRes.statusCode),
    "Expected /ready response",
  );
  console.log("✓ /ready endpoint verified");

  const metricsRes = await app.inject({
    method: "GET",
    url: "/metrics",
  });
  assert.equal(metricsRes.statusCode, 200);
  console.log("✓ /metrics endpoint verified");

  // ────────────────────────────────────────────────────────────
  // Test 2: Unauthenticated Route Protection (Clerk Auth Guards)
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 2] Auth Gating Verification (Clerk Middleware)");
  const protectedCustomerEndpoints = [
    { method: "GET" as const, url: "/api/v1/me/wishlists" },
    { method: "POST" as const, url: "/api/v1/me/wishlists" },
    { method: "POST" as const, url: "/api/v1/me/wishlists/merge" },
    {
      method: "PATCH" as const,
      url: "/api/v1/me/wishlists/00000000-0000-0000-0000-000000000001",
    },
    {
      method: "DELETE" as const,
      url: "/api/v1/me/wishlists/00000000-0000-0000-0000-000000000001",
    },
    {
      method: "POST" as const,
      url: "/api/v1/me/wishlists/00000000-0000-0000-0000-000000000001/items/move",
    },
    {
      method: "POST" as const,
      url: "/api/v1/me/wishlists/00000000-0000-0000-0000-000000000001/share",
    },
  ];

  for (const ep of protectedCustomerEndpoints) {
    const res = await app.inject({
      method: ep.method,
      url: ep.url,
      payload: {},
    });
    assert.equal(
      res.statusCode,
      401,
      `Expected ${ep.method} ${ep.url} to reject unauthenticated request with 401`,
    );
  }
  // Forged gateway header without valid internal secret must be rejected
  const forgedRes = await app.inject({
    method: "GET",
    url: "/api/v1/me/wishlists",
    headers: {
      "x-user-id": "hacker-user-id",
    },
  });
  assert.equal(
    forgedRes.statusCode,
    401,
    "Expected forged x-user-id without internal secret to be rejected with 401",
  );
  console.log(
    "✓ All customer-authenticated endpoints strictly reject unauthenticated requests and forged headers",
  );

  // ────────────────────────────────────────────────────────────
  // Test 3: Zod Schema Contract Validation
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 3] Zod Schema Validation Contracts");

  // CreateWishlistSchema
  assert.doesNotThrow(() =>
    CreateWishlistSchema.parse({ name: "Summer Trip", visibility: "PRIVATE" }),
  );
  assert.throws(() => CreateWishlistSchema.parse({ name: "" }));

  // AddWishlistItemSchema
  assert.doesNotThrow(() =>
    AddWishlistItemSchema.parse({
      productId: "prod_nike_101",
      addedPrice: 120.5,
      priority: 2,
    }),
  );
  assert.throws(() =>
    AddWishlistItemSchema.parse({
      productId: "",
      addedPrice: -10,
    }),
  );

  // MoveWishlistItemSchema
  assert.doesNotThrow(() =>
    MoveWishlistItemSchema.parse({
      targetWishlistId: "11111111-1111-4111-a111-111111111111",
    }),
  );

  // MergeWishlistSchema
  assert.doesNotThrow(() =>
    MergeWishlistSchema.parse({
      guestId: "guest_session_999",
      conflictStrategy: "KEEP_EXISTING",
    }),
  );

  console.log("✓ Zod schemas strictly validate domain contracts");

  // ────────────────────────────────────────────────────────────
  // Test 4: Default Wishlist Auto-Creation & Retrieval
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 4] Default Wishlist Auto-Creation");
  const testUserId = `test_usr_${Date.now()}`;
  const authHeaders = {
    [GATEWAY_HEADERS.INTERNAL_SECRET]: "dev-shared-internal-secret-larekmart",
    [GATEWAY_HEADERS.USER_ID]: testUserId,
  };

  const listRes = await app.inject({
    method: "GET",
    url: "/api/v1/me/wishlists",
    headers: authHeaders,
  });

  assert.equal(listRes.statusCode, 200);
  const listJson = JSON.parse(listRes.payload);
  assert.equal(listJson.total, 1);
  assert.equal(listJson.wishlists.length, 1);
  const defaultWishlist = listJson.wishlists[0];
  assert.equal(defaultWishlist.isDefault, true);
  assert.equal(defaultWishlist.name, "My Wishlist");
  console.log(
    `✓ Default wishlist automatically initialized (${defaultWishlist.id})`,
  );

  // ────────────────────────────────────────────────────────────
  // Test 5: Adding Items & Duplicate Prevention
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 5] Adding Items and Duplicate Prevention");
  const addItemRes = await app.inject({
    method: "POST",
    url: `/api/v1/me/wishlists/${defaultWishlist.id}/items`,
    headers: authHeaders,
    payload: {
      productId: "prod_macbook_pro_16",
      addedPrice: 2499.0,
      note: "For software development",
      priority: 5,
    },
  });

  assert.equal(addItemRes.statusCode, 201);
  const addItemJson = JSON.parse(addItemRes.payload);
  assert.equal(addItemJson.isDuplicate, false);
  const createdItemId = addItemJson.item.id;
  assert.ok(createdItemId);
  console.log("✓ Item successfully added to wishlist");

  // Attempt duplicate addition
  const dupItemRes = await app.inject({
    method: "POST",
    url: `/api/v1/me/wishlists/${defaultWishlist.id}/items`,
    headers: authHeaders,
    payload: {
      productId: "prod_macbook_pro_16",
      addedPrice: 2499.0,
    },
  });

  assert.equal(dupItemRes.statusCode, 200);
  const dupItemJson = JSON.parse(dupItemRes.payload);
  assert.equal(dupItemJson.isDuplicate, true);
  assert.equal(dupItemJson.item.id, createdItemId);
  console.log("✓ Duplicate addition gracefully prevented");

  // ────────────────────────────────────────────────────────────
  // Test 6: Named Wishlists & Moving Items
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 6] Multiple Named Wishlists & Move Operation");
  const createNamedRes = await app.inject({
    method: "POST",
    url: "/api/v1/me/wishlists",
    headers: authHeaders,
    payload: {
      name: "Office Setup Ideas",
      visibility: "PRIVATE",
    },
  });

  assert.equal(createNamedRes.statusCode, 201);
  const namedWishlist = JSON.parse(createNamedRes.payload);
  assert.equal(namedWishlist.name, "Office Setup Ideas");

  // Move item from default wishlist to "Office Setup Ideas"
  const moveRes = await app.inject({
    method: "POST",
    url: `/api/v1/me/wishlists/${defaultWishlist.id}/items/move`,
    headers: authHeaders,
    payload: {
      itemId: createdItemId,
      targetWishlistId: namedWishlist.id,
    },
  });

  assert.equal(moveRes.statusCode, 200);
  console.log("✓ Item successfully moved between wishlists");

  // ────────────────────────────────────────────────────────────
  // Test 7: Guest Wishlist & Merge Flow
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 7] Guest-to-User Wishlist Migration");
  const guestId = `guest_${Date.now()}`;

  // 1. Guest creates a wishlist
  const guestWishlistRes = await app.inject({
    method: "POST",
    url: "/api/v1/me/wishlists",
    headers: {
      "x-guest-id": guestId,
    },
    payload: {
      name: "Guest Wishlist",
    },
  });

  const guestWishlist = JSON.parse(guestWishlistRes.payload);

  // Guest adds item
  await app.inject({
    method: "POST",
    url: `/api/v1/me/wishlists/${guestWishlist.id}/items`,
    headers: {
      "x-guest-id": guestId,
    },
    payload: {
      productId: "prod_wireless_mouse_404",
      addedPrice: 49.99,
    },
  });

  // 2. User merges guest items
  const mergeRes = await app.inject({
    method: "POST",
    url: "/api/v1/me/wishlists/merge",
    headers: authHeaders,
    payload: {
      guestId,
      conflictStrategy: "KEEP_EXISTING",
    },
  });

  assert.equal(mergeRes.statusCode, 200);
  console.log("✓ Guest wishlist merged into authenticated customer account");

  // ────────────────────────────────────────────────────────────
  // Test 8: Shared Wishlist Tokens & Access Control
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 8] Shared Wishlist Unguessable Tokens");
  const shareRes = await app.inject({
    method: "POST",
    url: `/api/v1/me/wishlists/${namedWishlist.id}/share`,
    headers: authHeaders,
    payload: {
      permission: "VIEW",
      expiresInDays: 7,
    },
  });

  assert.equal(shareRes.statusCode, 201);
  const shareJson = JSON.parse(shareRes.payload);
  assert.ok(shareJson.shareToken.startsWith("wsh_"));
  assert.ok(shareJson.shareToken.length > 30);
  console.log(`✓ Unguessable share token generated: ${shareJson.shareToken}`);

  // Fetch shared wishlist publicly
  const fetchSharedRes = await app.inject({
    method: "GET",
    url: `/api/v1/shared-wishlists/${shareJson.shareToken}`,
  });

  assert.equal(fetchSharedRes.statusCode, 200);
  const fetchedSharedJson = JSON.parse(fetchSharedRes.payload);
  assert.equal(fetchedSharedJson.wishlist.id, namedWishlist.id);
  assert.equal(fetchedSharedJson.permission, "VIEW");
  console.log(
    "✓ Public shared wishlist correctly resolved with access controls",
  );

  // Unknown token returns 404
  const invalidShareRes = await app.inject({
    method: "GET",
    url: "/api/v1/shared-wishlists/wsh_invalid_fake_token_12345",
  });
  assert.equal(invalidShareRes.statusCode, 404);
  console.log("✓ Invalid share token strictly rejected with 404");

  // ────────────────────────────────────────────────────────────
  // Test 9: Bulk Item Removal
  // ────────────────────────────────────────────────────────────
  console.log("\n[Test 9] Bulk Item Removal");
  const bulkDelRes = await app.inject({
    method: "DELETE",
    url: `/api/v1/me/wishlists/${namedWishlist.id}/items`,
    headers: authHeaders,
    payload: {
      itemIds: [createdItemId],
    },
  });

  assert.equal(bulkDelRes.statusCode, 200);
  console.log("✓ Bulk item removal verified");

  console.log("\n==========================================");
  console.log("   ALL WISHLIST SERVICE TESTS PASSED!     ");
  console.log("==========================================");
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failure:", err);
    process.exit(1);
  });
