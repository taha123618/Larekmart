---
name: cart-and-checkout
description: Use when modifying the customer cart Zustand store, optimistic cart updates, shipping validation, or Stripe Elements integration in apps/client.
---

# Cart & Stripe Checkout Architecture

Guidance for customer cart state and checkout in `apps/client`.

## 1. Zustand Cart Store (`src/stores/cartStore.ts`)

- Store Shape: `cart` array of `CartItemType`, `addItem()`, `removeItem()`, `updateQuantity()`, `clearCart()`.
- Persisted to `localStorage` under `cart-storage` key with Zustand `persist`.
- Total calculation: compute `item.price * item.quantity` dynamically.

## 2. Shipping Address & Checkout Initialization

- Shipping form validates address using `shippingFormSchema` from `@repo/types`.
- `POST /sessions/create-checkout-session` transmits items and shipping details to `payment-service`.
- Receives `clientSecret` and initializes Stripe Elements with `@stripe/react-stripe-js`.

## 3. Post-Payment Return Flow

- On Stripe confirmation redirect to `/return`, poll session status with `GET /sessions/:id`.
- On verified completion, prompt customer and provide link to `/orders`.
