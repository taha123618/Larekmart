/**
 * @repo/e2e — Shared End-to-End Testing Utilities and Fixtures for Larekmart
 */

import { type Page, expect } from "@playwright/test";

export const TEST_CONFIG = {
  clientUrl: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3002",
  adminUrl: process.env.ADMIN_BASE_URL || "http://localhost:3003",
  sellerUrl: process.env.SELLER_BASE_URL || "http://localhost:3004",
  gatewayUrl: process.env.GATEWAY_BASE_URL || "http://localhost:8090",
  stripeTestCard: "4242 4242 4242 4242",
  stripeExpiry: "12/28",
  stripeCvc: "123",
  stripeZip: "90210",
};

/**
 * Fills out Stripe Payment Element or standard credit card iframe fields
 */
export async function fillStripePayment(page: Page, card = TEST_CONFIG.stripeTestCard) {
  const stripeIframe = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
  if (await stripeIframe.locator('input[name="number"]').isVisible({ timeout: 5000 }).catch(() => false)) {
    await stripeIframe.locator('input[name="number"]').fill(card);
    await stripeIframe.locator('input[name="exp-date"]').fill(TEST_CONFIG.stripeExpiry);
    await stripeIframe.locator('input[name="cvc"]').fill(TEST_CONFIG.stripeCvc);
    if (await stripeIframe.locator('input[name="postal"]').isVisible().catch(() => false)) {
      await stripeIframe.locator('input[name="postal"]').fill(TEST_CONFIG.stripeZip);
    }
  }
}

/**
 * Common test assertions
 */
export async function assertCartCount(page: Page, expectedCount: number) {
  const badge = page.locator('[data-testid="cart-count"], [aria-label*="cart count"]').first();
  await expect(badge).toHaveText(String(expectedCount));
}
