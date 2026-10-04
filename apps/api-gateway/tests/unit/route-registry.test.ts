import assert from "node:assert/strict";
import { allGatewayRoutes, findRouteForPath } from "../../src/gateway/route-registry.js";
import { services } from "../../src/gateway/service-registry.js";

export async function runRouteRegistryTests() {
  console.log("▶ [UNIT] Running Route Registry tests...");

  // Test 1: All downstream services are registered
  const registeredServices = new Set(allGatewayRoutes.map((r) => r.serviceName));
  assert.ok(registeredServices.has("auth-service"), "auth-service should be registered");
  assert.ok(registeredServices.has("user-service"), "user-service should be registered");
  assert.ok(registeredServices.has("product-service"), "product-service should be registered");
  assert.ok(registeredServices.has("catalog-service"), "catalog-service should be registered");
  assert.ok(registeredServices.has("cart-service"), "cart-service should be registered");
  assert.ok(registeredServices.has("order-service"), "order-service should be registered");
  assert.ok(registeredServices.has("payment-service"), "payment-service should be registered");
  assert.ok(registeredServices.has("inventory-service"), "inventory-service should be registered");
  assert.ok(registeredServices.has("shipping-service"), "shipping-service should be registered");
  assert.ok(registeredServices.has("search-service"), "search-service should be registered");
  assert.ok(registeredServices.has("media-service"), "media-service should be registered");

  // Test 2: findRouteForPath returns the correct route
  const productRoute = findRouteForPath("/api/v1/products");
  assert.ok(productRoute, "Route for /api/v1/products must exist");
  assert.equal(productRoute.serviceName, "product-service");
  assert.equal(productRoute.target, services.product.url);

  const cartRoute = findRouteForPath("/api/v1/cart");
  assert.ok(cartRoute, "Route for /api/v1/cart must exist");
  assert.equal(cartRoute.serviceName, "cart-service");

  const orderRoute = findRouteForPath("/api/v1/orders");
  assert.ok(orderRoute, "Route for /api/v1/orders must exist");
  assert.equal(orderRoute.serviceName, "order-service");

  // Test 3: Unmatched route returns undefined
  const unknownRoute = findRouteForPath("/api/v1/non-existent-endpoint-xyz");
  assert.equal(unknownRoute, undefined, "Unmatched route should return undefined");

  console.log("✔ [UNIT] Route Registry tests passed");
}
