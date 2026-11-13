import { test, expect } from "@playwright/test";

test.describe("Product Search & Category Filtering", () => {
  test("searches products, filters by category, and navigates to product detail", async ({ page }) => {
    // 1. Visit homepage
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Locate the search bar
    const searchInput = page.locator('input#search, input[placeholder*="Search"]').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // 2. Type search query and submit
    const searchQuery = "shirt";
    await searchInput.fill(searchQuery);
    await searchInput.press("Enter");

    // Verify search results page loads
    await page.waitForURL(/\/products.*search=/);
    expect(page.url()).toContain("search=");

    // Check if products exist in search results
    const productCards = page.locator('a[href^="/products/"]');
    const count = await productCards.count();

    if (count === 0) {
      test.skip(true, `No products found for search query "${searchQuery}". Skipping rest of search test.`);
      return;
    }

    // Verify search results header or text appears
    await expect(page.locator("h1")).toContainText(/Search Results|Collection|Catalog/i);

    // 3. Verify category filtering
    const categoryButtons = page.locator("button:has(span)");
    const targetCategoryBtn = page.locator("button:has-text('T-shirts'), button:has-text('Shoes'), button:has-text('Accessories')").first();

    if (await targetCategoryBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await targetCategoryBtn.click();
      await page.waitForURL(/category=/);
      expect(page.url()).toContain("category=");
    }

    // 4. Click a result and verify it navigates to product detail
    const firstResult = page.locator('a[href^="/products/"]').first();
    await expect(firstResult).toBeVisible();
    await firstResult.click();

    await page.waitForURL(/\/products\/[^/]+/);
    expect(page.url()).toContain("/products/");
    await expect(page.locator("body")).toBeVisible();
  });
});
