# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: customer-checkout.spec.ts >> Customer Checkout Flow >> completes end-to-end customer checkout
- Location: tests/customer-checkout.spec.ts:4:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3002/
Call log:
  - navigating to "http://localhost:3002/", waiting until "load"

```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | 
  3   | test.describe("Customer Checkout Flow", () => {
  4   |   test("completes end-to-end customer checkout", async ({ page, baseURL }) => {
  5   |     // 1. Browse to homepage
> 6   |     await page.goto("/");
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3002/
  7   |     await expect(page).toHaveTitle(/Larekmart/i);
  8   | 
  9   |     // Navigate to products page
  10  |     await page.goto("/products");
  11  |     await page.waitForLoadState("domcontentloaded");
  12  | 
  13  |     // Check if any product exists in the DB/catalog listing
  14  |     const productLinks = page.locator('a[href^="/products/"]');
  15  |     const productCount = await productLinks.count();
  16  | 
  17  |     if (productCount === 0) {
  18  |       test.skip(true, "No products found in the catalog database. Skipping checkout test.");
  19  |       return;
  20  |     }
  21  | 
  22  |     // 2. Click on a product -> verify product detail page loads
  23  |     const firstProduct = productLinks.first();
  24  |     const productHref = await firstProduct.getAttribute("href");
  25  |     await firstProduct.click();
  26  | 
  27  |     await page.waitForURL(/\/products\/[^/]+/);
  28  |     expect(page.url()).toContain("/products/");
  29  | 
  30  |     // Check if product is out of stock
  31  |     const outOfStockButton = page.locator("button:has-text('Out of Stock')");
  32  |     if (await outOfStockButton.isVisible()) {
  33  |       test.skip(true, "First product is out of stock. Skipping checkout test.");
  34  |       return;
  35  |     }
  36  | 
  37  |     // 3. Add item to cart -> verify cart counter updates
  38  |     const addToCartButton = page.locator("button:has-text('Add to Cart')").first();
  39  |     await expect(addToCartButton).toBeVisible({ timeout: 10000 });
  40  |     await addToCartButton.click();
  41  | 
  42  |     // Verify cart counter updates in header (e.g. aria-label="Shopping cart with X items" or badge)
  43  |     const cartButton = page.locator('button[aria-label*="Shopping cart with"]').first();
  44  |     await expect(cartButton).toBeVisible();
  45  |     await expect(cartButton).toHaveAttribute("aria-label", /Shopping cart with [1-9]\d* item/);
  46  | 
  47  |     // 4. Open cart -> verify item is listed
  48  |     await page.goto("/cart");
  49  |     await page.waitForLoadState("domcontentloaded");
  50  |     await expect(page.locator("h1")).toContainText(/Shopping Cart/i);
  51  | 
  52  |     // Verify cart has at least 1 item listed
  53  |     const cartItems = page.locator('button:has-text("Proceed to Shipping")');
  54  |     await expect(cartItems).toBeVisible({ timeout: 10000 });
  55  | 
  56  |     // 5. Navigate to shipping address (Step 2)
  57  |     await cartItems.click();
  58  |     await page.waitForURL(/step=2/);
  59  | 
  60  |     // Fill shipping address form
  61  |     await page.locator('input#name, input[placeholder*="Muhammad Ali"]').fill("Jane Doe");
  62  |     await page.locator('input#email, input[placeholder*="ali@example.com"]').fill("jane.doe@example.com");
  63  |     await page.locator('input#phone, input[placeholder*="0300"]').fill("+15551234567");
  64  |     await page.locator('input#city, input[placeholder*="Karachi"]').fill("New York");
  65  |     await page.locator('input#address, input[placeholder*="House"]').fill("123 Broadway Avenue");
  66  | 
  67  |     // Submit shipping form -> Proceeds to Step 3 (Payment Method)
  68  |     const proceedToPaymentButton = page.locator('button[type="submit"]:has-text("Proceed to Payment")');
  69  |     await proceedToPaymentButton.click();
  70  |     await page.waitForURL(/step=3/);
  71  | 
  72  |     // 6. Handle Payment Step (Stripe checkout)
  73  |     // Setup route interception in case Stripe test mode is not configured locally or mocked
  74  |     const mockSessionId = "cs_test_e2e_" + Date.now();
  75  |     await page.route("**/api/v1/sessions/create-checkout-session", async (route) => {
  76  |       await route.fulfill({
  77  |         status: 200,
  78  |         contentType: "application/json",
  79  |         body: JSON.stringify({
  80  |           sessionId: mockSessionId,
  81  |           url: `${baseURL || "http://localhost:3002"}/return?session_id=${mockSessionId}`,
  82  |         }),
  83  |       });
  84  |     });
  85  | 
  86  |     // Check if Stripe payment form / Stripe elements iframe is loaded
  87  |     const stripeIframe = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
  88  |     const isStripeFrameVisible = await page
  89  |       .locator('iframe[name^="__privateStripeFrame"]')
  90  |       .first()
  91  |       .isVisible({ timeout: 5000 })
  92  |       .catch(() => false);
  93  | 
  94  |     if (isStripeFrameVisible) {
  95  |       // Fill Stripe test card details
  96  |       const cardNumberInput = stripeIframe.locator('input[name="number"], input[name="cardnumber"], input[autocomplete="cc-number"]');
  97  |       if (await cardNumberInput.isVisible({ timeout: 5000 }).catch(() => false)) {
  98  |         await cardNumberInput.fill("4242 4242 4242 4242");
  99  |         await stripeIframe.locator('input[name="exp-date"], input[autocomplete="cc-exp"]').fill("12/26");
  100 |         await stripeIframe.locator('input[name="cvc"], input[autocomplete="cc-csc"]').fill("123");
  101 |       }
  102 | 
  103 |       const payNowButton = page.locator('button:has-text("Pay Now")');
  104 |       if (await payNowButton.isVisible()) {
  105 |         await payNowButton.click();
  106 |       }
```