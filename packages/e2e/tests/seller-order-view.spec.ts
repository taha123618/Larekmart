import { test, expect } from "@playwright/test";

test.describe("Seller Order Management View", () => {
  test("authenticates as seller and verifies orders table is accessible", async ({ page }) => {
    const sellerEmail = process.env.SELLER_TEST_EMAIL;
    const sellerPassword = process.env.SELLER_TEST_PASSWORD;
    const sellerBaseUrl = process.env.SELLER_BASE_URL || "http://localhost:3004";

    if (!sellerEmail || !sellerPassword) {
      test.skip(true, "SELLER_TEST_EMAIL and SELLER_TEST_PASSWORD env vars are not set. Skipping seller order view test.");
      return;
    }

    // Navigate to seller login
    await page.goto(`${sellerBaseUrl}/login`);
    await page.waitForLoadState("domcontentloaded");

    // Fill login credentials
    const emailInput = page.locator('input#email, input[type="email"]');
    const passwordInput = page.locator('input#password, input[type="password"]');

    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await emailInput.fill(sellerEmail);
    await passwordInput.fill(sellerPassword);

    // Submit login form
    const submitButton = page.locator('button[type="submit"], button:has-text("Sign in")').first();
    await submitButton.click();

    // Wait for redirect to dashboard or orders
    await page.waitForURL(new RegExp(`${sellerBaseUrl}/(dashboard|orders)`), { timeout: 15000 });

    // Navigate to orders management view
    await page.goto(`${sellerBaseUrl}/orders`);
    await page.waitForLoadState("domcontentloaded");

    // Verify orders section header and table
    await expect(page.locator("h1, h2, h3, header")).toContainText(/Order/i);
    const ordersTable = page.locator("table");
    await expect(ordersTable).toBeVisible({ timeout: 10000 });
  });
});
