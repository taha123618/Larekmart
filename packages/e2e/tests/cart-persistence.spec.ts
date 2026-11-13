import { test, expect } from "@playwright/test";

test.describe("Cart Persistence", () => {
  test("persists guest cart in localStorage across page reloads", async ({ page }) => {
    // Navigate to products page
    await page.goto("/products");
    await page.waitForLoadState("domcontentloaded");

    const productLinks = page.locator('a[href^="/products/"]');
    const productCount = await productLinks.count();

    if (productCount === 0) {
      test.skip(true, "No products found in catalog database. Skipping cart persistence test.");
      return;
    }

    // Open first product
    await productLinks.first().click();
    await page.waitForURL(/\/products\/[^/]+/);

    // Skip if out of stock
    const outOfStockButton = page.locator("button:has-text('Out of Stock')");
    if (await outOfStockButton.isVisible()) {
      test.skip(true, "Product is out of stock. Skipping cart persistence test.");
      return;
    }

    // Add product to cart
    const addToCartButton = page.locator("button:has-text('Add to Cart')").first();
    await expect(addToCartButton).toBeVisible({ timeout: 10000 });
    await addToCartButton.click();

    // Verify initial cart badge shows at least 1 item
    const cartButton = page.locator('button[aria-label*="Shopping cart with"]').first();
    await expect(cartButton).toBeVisible({ timeout: 10000 });
    await expect(cartButton).toHaveAttribute("aria-label", /Shopping cart with [1-9]\d* item/);

    // Verify localStorage has persisted cart key
    const rawCart = await page.evaluate(() => window.localStorage.getItem("cart"));
    expect(rawCart).not.toBeNull();
    const parsed = JSON.parse(rawCart || "{}");
    expect(parsed.state?.cart?.length).toBeGreaterThan(0);

    // Reload the page
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    // Verify cart count badge remains persisted after reload
    const cartButtonAfterReload = page.locator('button[aria-label*="Shopping cart with"]').first();
    await expect(cartButtonAfterReload).toBeVisible({ timeout: 10000 });
    await expect(cartButtonAfterReload).toHaveAttribute("aria-label", /Shopping cart with [1-9]\d* item/);

    // Verify cart page loads with the item present
    await page.goto("/cart");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).not.toContainText("Your cart is currently empty");
  });
});
