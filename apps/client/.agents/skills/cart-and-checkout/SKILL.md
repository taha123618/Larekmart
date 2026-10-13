---
name: cart-and-checkout
description: Use when modifying the customer cart Zustand store, optimistic cart updates, shipping validation, multi-carrier rates, COD orders, or Stripe Elements integration in apps/client.
---

# Cart & Multi-Channel Checkout Architecture

Guidance for customer cart state, shipping rate calculation, Cash on Delivery (COD), and Stripe checkout in `apps/client`.

## 1. Zustand Cart Store (`src/stores/cartStore.ts`)

- Store Shape: `cart` array of `CartItemType`, `addItem()`, `removeItem()`, `updateQuantity()`, `clearCart()`.
- Persisted to `localStorage` under `cart-storage` key with Zustand `persist` middleware.
- SSR Protection: Access to `localStorage` is wrapped in `typeof window !== "undefined"` and dummy fallbacks to prevent Node 22 server warnings.
- Server Cart Sync: Optimistic client updates synchronized with authoritative `cart-service` (`NEXT_PUBLIC_CART_SERVICE_URL` :8009) when user is authenticated with Clerk.

## 2. Multi-Carrier Shipping & Address Selection (`ShippingForm.tsx`)

- **Modern Glassmorphic Inputs**: Responsive 2-column input grid for (Full Name, Email) and (Phone, City) with `rounded-xl` glass cards and smooth focus states.
- **Saved Address Integration**: Queries `user-service` (`GET /users/me/addresses`) with Clerk token; supports 1-click autofill and account address saving (`POST /users/me/addresses`).
- **Dynamic Carrier Quotes**: Calls `shipping.service.ts` (`fetchShippingRates(city)`) to retrieve live quotes from TCS, Leopards, DHL, or direct courier delivery.
- **Cash on Delivery Toggle**: Switch enabling COD handling fees and flagging order payload for cash collection upon parcel arrival.

## 3. Stripe Card Checkout (`StripePaymentForm.tsx`, `CheckoutForm.tsx`)

- Calls `payment-service` (`POST /sessions/create-checkout-session`) with cart contents and Clerk token to receive `checkoutSessionClientSecret`.
- Initializes Stripe Elements using `@stripe/react-stripe-js` (`CheckoutProvider`, `PaymentElement`).
- Resilient Error Handling: If Stripe publishable key is missing, provides an instant fallback switch to Cash on Delivery (COD) without blocking the order.
- Webhook Integration: On confirmation, Stripe webhooks trigger Kafka events creating the order in `order-service` and syncing analytics.

## 4. Cash on Delivery (COD) Flow (`CodConfirmationForm.tsx`)

- Calls `order-service` (`POST /orders/cod`) with shipping address, carrier name, items, and recomputed totals in paisa.
- Generates `orderId`, clears client cart via `clearCart(token)`, and renders a `rounded-3xl` glassmorphic confirmation modal with direct links to `/track` and `/orders`.

## 5. Post-Payment Return Flow (`return/page.tsx`)

- On Stripe confirmation redirect to `/return`, polls session status with `GET /sessions/:id`.
- On verified completion, clears cart via `ClearCartOnSuccess.tsx`, renders 3-stage delivery milestone progress, and links to tracking and invoice receipt.
