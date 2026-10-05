## 2026-10-05 - Application-Level N+1 Network Requests

**Learning:** Found an N+1 performance bottleneck in the `refreshPricing` method in `cart-service` where a network request to `product-service` was made inside a loop sequentially for each item in the cart.
**Action:** Used `Promise.all` over `Array.map` to fetch product data concurrently before aggregating, turning sequential O(N) network latency into parallel O(1) latency.
