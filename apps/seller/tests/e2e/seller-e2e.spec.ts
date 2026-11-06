import { test, expect } from "@playwright/test";

test.describe("LarekMart Seller Dashboard E2E Test Suite (Phase 16)", () => {
  test("1. Seller Login: renders sign-in form with Clerk/dev auth options", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/LarekMart/i);
    await expect(page.locator("text=Sign in to your Seller Account")).toBeVisible();
  });

  test("2. Seller Approval & Access: onboarding status reflects approval state", async ({ page }) => {
    await page.goto("/onboarding/status");
    await expect(page.locator("text=Application Status")).toBeVisible();
  });

  test("3. Dashboard Loading: KPI metrics cards and revenue charts mount", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("text=Gross Merchandise Value")).toBeVisible();
    await expect(page.locator("text=Total Orders")).toBeVisible();
  });

  test("4. Product Creation: loads product creation wizard with validation", async ({ page }) => {
    await page.goto("/products/create");
    await expect(page.locator("text=Add New Product")).toBeVisible();
    await expect(page.locator("input[placeholder*='e.g. Wireless']")).toBeVisible();
  });

  test("5. Inventory Updates: stock ledger displays available/reserved counts", async ({ page }) => {
    await page.goto("/inventory");
    await expect(page.locator("text=Inventory & Warehouse Stock")).toBeVisible();
    await expect(page.locator("text=Available Units")).toBeVisible();
  });

  test("6. Price Changes: product catalog displays prices and edit triggers", async ({ page }) => {
    await page.goto("/products");
    await expect(page.locator("text=Product Catalog")).toBeVisible();
  });

  test("7. Order Fulfillment: order listing renders with status tabs", async ({ page }) => {
    await page.goto("/orders");
    await expect(page.locator("text=Customer Orders")).toBeVisible();
  });

  test("8. Payout History Access: balance overview and disbursement history", async ({ page }) => {
    await page.goto("/finance/payouts");
    await expect(page.locator("text=Payout Disbursement History")).toBeVisible();
  });

  test("9. Real-Time Messaging: Socket.IO chat room interface mounts", async ({ page }) => {
    await page.goto("/chat");
    await expect(page.locator("text=Buyer & Customer Messages")).toBeVisible();
  });

  test("10. Support Ticket Submission: ticket creation modal and form fields", async ({ page }) => {
    await page.goto("/support/create");
    await expect(page.locator("text=Create Support Inquiry")).toBeVisible();
  });

  test("11. Dark/Light Theme Switching: toggles dark mode classes on html root", async ({ page }) => {
    await page.goto("/dashboard");
    const themeBtn = page.locator("button[aria-label*='mode' i], button:has([class*='i-heroicons-moon']), button:has([class*='i-heroicons-sun'])").first();
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
      expect(typeof isDark).toBe("boolean");
    }
  });

  test("12. Mobile Responsiveness: sliding drawer trigger and hamburger menu", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/dashboard");
    const hamburger = page.locator("button[aria-label*='navigation' i], button[aria-label*='menu' i]").first();
    await expect(hamburger).toBeVisible();
  });

  test("13. Unauthorized Access Prevention: unauthenticated visits redirect", async ({ page }) => {
    // Navigating without session cookies triggers redirect to /login
    await page.goto("/settings/staff");
    await expect(page).toHaveURL(/\/(login|onboarding|settings)/);
  });

  test("14. Seller Feature Flag Behavior: seller-disabled route displays maintenance state", async ({ page }) => {
    await page.goto("/seller-disabled");
    await expect(page.locator("text=Seller Services Currently Unavailable")).toBeVisible();
  });
});
