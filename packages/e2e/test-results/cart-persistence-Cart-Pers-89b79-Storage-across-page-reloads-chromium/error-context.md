# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cart-persistence.spec.ts >> Cart Persistence >> persists guest cart in localStorage across page reloads
- Location: tests/cart-persistence.spec.ts:4:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3002/products
Call log:
  - navigating to "http://localhost:3002/products", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.describe("Cart Persistence", () => {
  4  |   test("persists guest cart in localStorage across page reloads", async ({ page }) => {
  5  |     // Navigate to products page
> 6  |     await page.goto("/products");
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3002/products
  7  |     await page.waitForLoadState("domcontentloaded");
  8  | 
  9  |     const productLinks = page.locator('a[href^="/products/"]');
  10 |     const productCount = await productLinks.count();
  11 | 
  12 |     if (productCount === 0) {
  13 |       test.skip(true, "No products found in catalog database. Skipping cart persistence test.");
  14 |       return;
  15 |     }
  16 | 
  17 |     // Open first product
  18 |     await productLinks.first().click();
  19 |     await page.waitForURL(/\/products\/[^/]+/);
  20 | 
  21 |     // Skip if out of stock
  22 |     const outOfStockButton = page.locator("button:has-text('Out of Stock')");
  23 |     if (await outOfStockButton.isVisible()) {
  24 |       test.skip(true, "Product is out of stock. Skipping cart persistence test.");
  25 |       return;
  26 |     }
  27 | 
  28 |     // Add product to cart
  29 |     const addToCartButton = page.locator("button:has-text('Add to Cart')").first();
  30 |     await expect(addToCartButton).toBeVisible({ timeout: 10000 });
  31 |     await addToCartButton.click();
  32 | 
  33 |     // Verify initial cart badge shows at least 1 item
  34 |     const cartButton = page.locator('button[aria-label*="Shopping cart with"]').first();
  35 |     await expect(cartButton).toBeVisible({ timeout: 10000 });
  36 |     await expect(cartButton).toHaveAttribute("aria-label", /Shopping cart with [1-9]\d* item/);
  37 | 
  38 |     // Verify localStorage has persisted cart key
  39 |     const rawCart = await page.evaluate(() => window.localStorage.getItem("cart"));
  40 |     expect(rawCart).not.toBeNull();
  41 |     const parsed = JSON.parse(rawCart || "{}");
  42 |     expect(parsed.state?.cart?.length).toBeGreaterThan(0);
  43 | 
  44 |     // Reload the page
  45 |     await page.reload();
  46 |     await page.waitForLoadState("domcontentloaded");
  47 | 
  48 |     // Verify cart count badge remains persisted after reload
  49 |     const cartButtonAfterReload = page.locator('button[aria-label*="Shopping cart with"]').first();
  50 |     await expect(cartButtonAfterReload).toBeVisible({ timeout: 10000 });
  51 |     await expect(cartButtonAfterReload).toHaveAttribute("aria-label", /Shopping cart with [1-9]\d* item/);
  52 | 
  53 |     // Verify cart page loads with the item present
  54 |     await page.goto("/cart");
  55 |     await page.waitForLoadState("domcontentloaded");
  56 |     await expect(page.locator("body")).not.toContainText("Your cart is currently empty");
  57 |   });
  58 | });
  59 | 
```