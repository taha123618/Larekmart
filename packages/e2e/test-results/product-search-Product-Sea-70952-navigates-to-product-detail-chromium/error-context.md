# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-search.spec.ts >> Product Search & Category Filtering >> searches products, filters by category, and navigates to product detail
- Location: tests/product-search.spec.ts:4:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3002/
Call log:
  - navigating to "http://localhost:3002/", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.describe("Product Search & Category Filtering", () => {
  4  |   test("searches products, filters by category, and navigates to product detail", async ({ page }) => {
  5  |     // 1. Visit homepage
> 6  |     await page.goto("/");
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3002/
  7  |     await page.waitForLoadState("domcontentloaded");
  8  | 
  9  |     // Locate the search bar
  10 |     const searchInput = page.locator('input#search, input[placeholder*="Search"]').first();
  11 |     await expect(searchInput).toBeVisible({ timeout: 10000 });
  12 | 
  13 |     // 2. Type search query and submit
  14 |     const searchQuery = "shirt";
  15 |     await searchInput.fill(searchQuery);
  16 |     await searchInput.press("Enter");
  17 | 
  18 |     // Verify search results page loads
  19 |     await page.waitForURL(/\/products.*search=/);
  20 |     expect(page.url()).toContain("search=");
  21 | 
  22 |     // Check if products exist in search results
  23 |     const productCards = page.locator('a[href^="/products/"]');
  24 |     const count = await productCards.count();
  25 | 
  26 |     if (count === 0) {
  27 |       test.skip(true, `No products found for search query "${searchQuery}". Skipping rest of search test.`);
  28 |       return;
  29 |     }
  30 | 
  31 |     // Verify search results header or text appears
  32 |     await expect(page.locator("h1")).toContainText(/Search Results|Collection|Catalog/i);
  33 | 
  34 |     // 3. Verify category filtering
  35 |     const categoryButtons = page.locator("button:has(span)");
  36 |     const targetCategoryBtn = page.locator("button:has-text('T-shirts'), button:has-text('Shoes'), button:has-text('Accessories')").first();
  37 | 
  38 |     if (await targetCategoryBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
  39 |       await targetCategoryBtn.click();
  40 |       await page.waitForURL(/category=/);
  41 |       expect(page.url()).toContain("category=");
  42 |     }
  43 | 
  44 |     // 4. Click a result and verify it navigates to product detail
  45 |     const firstResult = page.locator('a[href^="/products/"]').first();
  46 |     await expect(firstResult).toBeVisible();
  47 |     await firstResult.click();
  48 | 
  49 |     await page.waitForURL(/\/products\/[^/]+/);
  50 |     expect(page.url()).toContain("/products/");
  51 |     await expect(page.locator("body")).toBeVisible();
  52 |   });
  53 | });
  54 | 
```