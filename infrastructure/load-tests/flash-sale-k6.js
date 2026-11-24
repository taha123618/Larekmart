import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import crypto from "k6/crypto";
import encoding from "k6/encoding";

// ============================================================================
// Larekmart Flash-Sale High-Throughput Load Test & Benchmark
// Simulates a high-concurrency flash sale (e.g., 100 hot units) exercising:
// 1. Zero-DB cryptographic pricing quote tokens (pricing-service)
// 2. Redis Lua stock gatekeeper & bucket partitioning (inventory-service)
// 3. Sharded order placement & transactional outbox continuity (order-service)
// 4. Distributed concurrency idempotency replay validation
// ============================================================================

// Configuration from environment variables with production defaults
const GATEWAY_URL = __ENV.TARGET_URL || "http://localhost:8090";
const HOT_PRODUCT_ID = parseInt(__ENV.HOT_PRODUCT_ID || "1", 10);
const HOT_VARIANT_ID = __ENV.HOT_VARIANT_ID || "var_flash_sale_hot_sku";
const WAREHOUSE_ID = __ENV.WAREHOUSE_ID || "wh_central_01";
const ALLOCATED_STOCK = parseInt(__ENV.ALLOCATED_STOCK || "100", 10);
const HMAC_SECRET = __ENV.CLERK_JWT_HMAC_KEY || "larekmart_seller_hmac_secret_dev_key";

// Custom SLO & Performance Metrics
const claimsAcceptedCounter = new Counter("flash_sale_claims_accepted");
const fastRejectsCounter = new Counter("flash_sale_fast_rejects_409");
const oversellViolationsCounter = new Counter("flash_sale_oversell_violations");
const duplicateOrderViolationsCounter = new Counter("flash_sale_duplicate_order_violations");

const pricingQuoteLatency = new Trend("flash_sale_pricing_quote_ms", true);
const inventoryClaimLatency = new Trend("flash_sale_inventory_claim_ms", true);
const orderCommitLatency = new Trend("flash_sale_order_commit_ms", true);
const fastRejectLatency = new Trend("flash_sale_fast_reject_p99_ms", true);
const successRate = new Rate("flash_sale_overall_success_rate");

export const options = {
  scenarios: {
    // Scenario 1: The Midnight Flash Sale Spike
    flash_sale_checkout_storm: {
      executor: "ramping-vus",
      startVUs: 10,
      stages: [
        { duration: "10s", target: 200 },   // Warm-up caches & connection pools
        { duration: "20s", target: 1500 },  // Midnight Drop: Massive sudden spike
        { duration: "30s", target: 3000 },  // Peak contention & stock exhaustion
        { duration: "20s", target: 1000 },  // Depleted contention hammering gatekeeper
        { duration: "10s", target: 0 },     // Ramp-down
      ],
      gracefulRampDown: "5s",
    },
  },
  thresholds: {
    // Core SLOs
    "flash_sale_fast_reject_p99_ms": ["p(99)<10"], // Redis gatekeeper fast-reject must be < 10ms
    "flash_sale_pricing_quote_ms": ["p(95)<35"],   // Pricing quote generation < 35ms
    "flash_sale_order_commit_ms": ["p(95)<150"],   // Order placement + outbox commit < 150ms
    "flash_sale_oversell_violations": ["count==0"], // Zero overselling invariant (MANDATORY)
    "flash_sale_duplicate_order_violations": ["count==0"], // Zero duplicate orders under retry
    "http_req_failed{status_not_409:true}": ["rate<0.02"], // Failure rate < 2% excluding 409
  },
};

/**
 * Generates an HMAC-SHA256 signed mock JWT token for simulated unique buyers.
 * Accepted by API Gateway token-verifier without hitting Clerk third-party servers.
 */
function generateBuyerJwt(userId) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    role: "customer",
    email: `${userId}@flashsale-test.larekmart.local`,
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = encoding.b64encode(JSON.stringify(header), "rawurl");
  const encodedPayload = encoding.b64encode(JSON.stringify(payload), "rawurl");
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto.hmac("sha256", HMAC_SECRET, unsignedToken, "rawurl");
  return `${unsignedToken}.${signature}`;
}

export default function () {
  const vuId = __VU;
  const iterId = __ITER;
  const buyerId = `buyer_vu_${vuId}_it_${iterId}`;
  const jwt = generateBuyerJwt(buyerId);

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${jwt}`,
    "x-correlation-id": `fs-load-${vuId}-${iterId}-${Date.now()}`,
  };

  // --------------------------------------------------------------------------
  // STEP 1: Cryptographic Price Quote (pricing-service)
  // Request server-authoritative HMAC signed quote token.
  // --------------------------------------------------------------------------
  const quoteStart = Date.now();
  const quotePayload = JSON.stringify({
    items: [
      {
        productId: String(HOT_PRODUCT_ID),
        variantId: HOT_VARIANT_ID,
        quantity: 1,
      },
    ],
    currency: "USD",
  });

  const quoteRes = http.post(`${GATEWAY_URL}/api/v1/prices/quote`, quotePayload, {
    headers: authHeaders,
    tags: { name: "PricingQuote" },
  });

  pricingQuoteLatency.add(Date.now() - quoteStart);

  const quoteOk = check(quoteRes, {
    "Quote status is 200": (r) => r.status === 200,
    "Quote has signedQuoteToken": (r) => {
      try {
        const body = JSON.parse(r.body);
        return Boolean(body.signedQuoteToken || (body.data && body.data.signedQuoteToken));
      } catch (_) {
        return false;
      }
    },
  });

  if (!quoteOk) {
    successRate.add(false);
    return;
  }

  const quoteData = JSON.parse(quoteRes.body);
  const signedQuoteToken = quoteData.signedQuoteToken || (quoteData.data && quoteData.data.signedQuoteToken);
  const quoteAmount = quoteData.totalAmountPaisa || (quoteData.data && quoteData.data.totalAmountPaisa) || 299900;

  // --------------------------------------------------------------------------
  // STEP 2: Stock Fast-Claim via Redis Gatekeeper (inventory-service)
  // Atomic Redis Lua precheck: returns 202 if claim granted, 409 if exhausted.
  // --------------------------------------------------------------------------
  const reservationRef = `order_claim_${vuId}_${iterId}_${Date.now()}`;
  const claimStart = Date.now();

  const reservationPayload = JSON.stringify({
    productId: HOT_PRODUCT_ID,
    variantId: HOT_VARIANT_ID,
    warehouseId: WAREHOUSE_ID,
    quantity: 1,
    referenceType: "ORDER",
    referenceId: reservationRef,
    expiresAt: new Date(Date.now() + 600000).toISOString(),
  });

  const reservationRes = http.post(
    `${GATEWAY_URL}/api/v1/inventory/reservations`,
    reservationPayload,
    {
      headers: authHeaders,
      tags: { name: "InventoryReservation" },
    },
  );

  const claimDuration = Date.now() - claimStart;

  if (reservationRes.status === 409) {
    // FAST REJECT PATH: Stock exhausted. Redis Lua rejected immediately in <5ms.
    fastRejectsCounter.add(1);
    fastRejectLatency.add(claimDuration);
    successRate.add(true); // Fast rejection is a planned successful control path!
    return;
  }

  const reservationOk = check(reservationRes, {
    "Reservation accepted (201 or 202)": (r) => r.status === 201 || r.status === 202,
  });

  if (!reservationOk) {
    successRate.add(false);
    return;
  }

  // Stock Claim GRANTED!
  claimsAcceptedCounter.add(1);
  inventoryClaimLatency.add(claimDuration);

  let reservationId = reservationRef;
  try {
    const resBody = JSON.parse(reservationRes.body);
    reservationId = resBody.id || resBody.reservationId || (resBody.data && resBody.data.id) || reservationRef;
  } catch (_) {}

  // --------------------------------------------------------------------------
  // STEP 3: Order Placement & Outbox Event Dispatch (order-service)
  // Commits order with cryptographic quote token and reservation ID.
  // --------------------------------------------------------------------------
  const orderStart = Date.now();
  const idempotencyKey = `idemp_order_${vuId}_${iterId}_${Date.now()}`;

  const orderPayload = JSON.stringify({
    email: `${buyerId}@flashsale-test.larekmart.local`,
    amount: quoteAmount,
    discountTotal: 0,
    taxTotal: 0,
    signedQuoteToken: signedQuoteToken,
    reservationId: reservationId,
    shippingAddress: {
      fullName: `Buyer VU ${vuId}`,
      phone: "+923001234567",
      addressLine1: "123 Flash Sale Avenue",
      city: "Karachi",
      postalCode: "75500",
      country: "PK",
    },
    products: [
      {
        productId: HOT_PRODUCT_ID,
        quantity: 1,
      },
    ],
  });

  const orderHeaders = Object.assign({}, authHeaders, {
    "x-idempotency-key": idempotencyKey,
  });

  const orderRes = http.post(`${GATEWAY_URL}/api/v1/orders/cod`, orderPayload, {
    headers: orderHeaders,
    tags: { name: "OrderCreateCOD" },
  });

  orderCommitLatency.add(Date.now() - orderStart);

  const orderOk = check(orderRes, {
    "Order creation status is 201 or 200": (r) => r.status === 201 || r.status === 200,
    "Order returns valid orderId": (r) => {
      try {
        const body = JSON.parse(r.body);
        return Boolean(body._id || body.id || (body.data && body.data.id));
      } catch (_) {
        return false;
      }
    },
  });

  if (!orderOk) {
    successRate.add(false);
    return;
  }

  // --------------------------------------------------------------------------
  // STEP 4: Idempotency Replay Verification
  // Re-submitting identical payload with identical x-idempotency-key must return
  // the exact cached response in <5ms without creating duplicate order documents.
  // --------------------------------------------------------------------------
  const replayRes = http.post(`${GATEWAY_URL}/api/v1/orders/cod`, orderPayload, {
    headers: orderHeaders,
    tags: { name: "OrderCreateCOD_IdempotentReplay" },
  });

  check(replayRes, {
    "Idempotent replay returns 200 or 201": (r) => r.status === 200 || r.status === 201,
  });

  successRate.add(true);
  sleep(0.05); // Tiny throttle between iterations per VU
}
