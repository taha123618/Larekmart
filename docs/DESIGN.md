# UI/UX Design System & Architectural Design (`docs/DESIGN.md`)

This document defines the visual design system, aesthetic standards, component specifications, motion principles, and responsive layout guidelines for the **Larekmart** platform frontends (`apps/client` storefront and `apps/admin` dashboard).

---

## 1. Aesthetic Vision & Design Philosophy

Larekmart delivers a **world-class global marketplace experience**, synthesising the best-converting patterns of premier platforms (AliExpress, Daraz, Amazon, and Alibaba) into an ultra-modern, high-performance interface:

- **Rich Modern Aesthetics**: Vibrant accents, bespoke dark theme (Obsidian `#0b0f19`), subtle glassmorphism with inner border reflections, and ambient mesh glows.
- **High Trust & Clarity**: Prominent buyer protection guarantees, verified seller badges, transparent shipping calculations, and SSL escrow confidence indicators.
- **Conversion-Optimised Discovery**: Real-time OpenSearch autocomplete omnibar, flash deals with live countdown tickers, dynamic stock progress meters, and AI-curated recommendation shelves.
- **Micro-Interaction Polish**: Silky spring-driven drawers, interactive color swatches, full-screen quick-view modals, floating scroll-to-top with live circular SVG progress, and timeline-choreographed hero banners.
- **Zero-Compromise Performance**: 60fps hardware-accelerated animations, Lenis smooth scrolling integration, strictly isolated motion boundaries, resilient SSR fallbacks, and strict hydration equality in React 19 and Next.js 16.

---

## 2. Design Tokens & Theme Foundation

The design system is implemented using **Tailwind CSS v4** tokens, custom CSS variables, and dark mode classes configured in `src/app/globals.css`.

### 2.1 Color Palette & Semantic System

| Token Role                | Light Mode Palette              | Dark Mode (Obsidian) Palette       | Purpose & Application                                                                             |
| :------------------------ | :------------------------------ | :--------------------------------- | :------------------------------------------------------------------------------------------------ |
| **Brand Primary**         | `indigo-600` / `violet-600`     | `indigo-500` / `violet-500`        | Primary buttons, active tabs, brand accents, links, and selected radio cards.                     |
| **Brand Gradient**        | `from-indigo-600 to-purple-600` | `from-indigo-500 to-purple-500`    | Primary CTAs, checkout buttons, hero banners, and active navigation badges.                       |
| **Base Surface**          | `white` / `slate-50`            | `#0b0f19` (Obsidian) / `slate-950` | Page background, root viewport canvas, and top utility bar.                                       |
| **Card Surface**          | `white` / `slate-100/80`        | `slate-900/80` / `#0b0f19/90`      | Product cards, category tiles, checkout summaries, and dropdown menus.                            |
| **Borders & Reflections** | `slate-200/80` / `slate-100`    | `slate-800/80` / `white/0.06`      | Crisp outer borders and subtle glassmorphic inner top-edge highlights (`inset_0_1px_0_0`).        |
| **Promotional / Urgency** | `rose-500` / `rose-600`         | `rose-500` / `rose-400`            | Flash deal badges, countdown seconds ticker, discount tags (`-25%`), and wishlist active hearts.  |
| **Rating & Highlights**   | `amber-400` / `amber-500`       | `amber-400` / `amber-300`          | Star ratings, promotional vouchers, "VIP Bonus" banners, and warning notices.                     |
| **Trust & Success**       | `emerald-600` / `teal-600`      | `emerald-500` / `teal-400`         | Buyer protection indicators, in-stock badges, free shipping tags, COD badges, and order receipts. |

### 2.2 Typography System

The interface pairs modern Google Fonts loaded via `next/font`:

- **Primary Body & Display**: `Geist Sans` (`--font-geist-sans`) — crisp, modern grotesque typeface offering supreme legibility across dense marketplace listings.
- **Numeric & Code**: `Geist Mono` (`--font-geist-mono`) — used for voucher codes, countdown tickers, order references, live pricing, and tabular data.

#### Typographic Hierarchy

- **Hero Title**: `text-3xl sm:text-5xl font-black tracking-tight leading-tight`
- **Section Heading**: `text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight`
- **Card Title**: `text-sm font-bold text-slate-900 dark:text-white line-clamp-1`
- **Pricing Headline**: `text-base sm:text-lg font-black text-slate-900 dark:text-white`
- **Original Price (Strikethrough)**: `text-xs text-slate-400 dark:text-slate-500 line-through`
- **Micro-Badges & Meta**: `text-[10px] sm:text-xs font-bold uppercase tracking-wider`

### 2.3 Radii, Elevation & Glassmorphism

- **Border Radii**:
  - `rounded-lg` / `rounded-xl`: Form controls, input cards, swatch chips, and thumbnails.
  - `rounded-2xl`: Product cards, category cards, omnibar dropdowns, and modal dialogs.
  - `rounded-3xl`: Hero banner containers, trust badge strips, shop CTA banner, and major section wrappers.
  - `rounded-full`: Floating action buttons, status pills, and color swatches.
- **Elevation**:
  - `shadow-xs`: Default card and button elevation.
  - `shadow-md` / `shadow-lg`: Hover elevation for product cards and primary CTAs.
  - `shadow-2xl`: Slide-over drawers (`CartDrawer`, `WishlistDrawer`) and quick-view modals.
  - `dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)]`: Ambient dark mode depth.
- **Glassmorphism**:
  - `bg-white/95 dark:bg-[#0b0f19]/85 backdrop-blur-xl`: Sticky navbar and floating omnibar.
  - `bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl`: Slide-over drawers, quick view modal, and notification panel.
  - `dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]`: Subtle inner light sheen on dark card borders.

---

## 3. Responsive Layout Architecture

The storefront is engineered **mobile-first**, scaling gracefully across all form factors:

```text
┌────────────────────────────────────────────────────────┐
│  Mobile (< 640px)                                      │
│  - Single/two-column adaptive product listings         │
│  - Horizontal scrollable category chip strips          │
│  - Full-screen slide-over drawers (Cart & Wishlist)    │
│  - Vertically stacked cart item rows & checkout forms  │
├────────────────────────────────────────────────────────┤
│  Tablet (640px – 1024px)                               │
│  - 2 to 3 column catalog product grids                 │
│  - 2-column responsive input grids (Name/Email, etc.)  │
│  - Side-by-side modal dialogs                          │
│  - Compact multi-tier header with omnibar              │
├────────────────────────────────────────────────────────┤
│  Desktop & Ultra-wide (1024px+)                        │
│  - 4 to 6 column product & department grids            │
│  - Side promotional voucher panels on Hero banner      │
│  - Max container width constrained to max-w-7xl (1280) │
└────────────────────────────────────────────────────────┘
```

### Breakpoint Matrix

| Viewport               | Tailwind Breakpoint            | Layout Behavior                                                                     |
| :--------------------- | :----------------------------- | :---------------------------------------------------------------------------------- |
| **Mobile Phones**      | `< 640px`                      | 1–2 col grids, horizontal swipeable ribbons, full-width drawers, stacked buttons.   |
| **Tablets / Phablets** | `sm` (`640px`)                 | 2–3 col product grids, top mega-menu ribbon appears, side-by-side cart rows.        |
| **Laptops**            | `md` / `lg` (`768px`–`1024px`) | Center omnibar search displays, side hero cards activate, 3–4 col grids.            |
| **Desktops**           | `xl` / `2xl` (`1280px`+)       | Full 4-col catalog, 6-col departments, maximum container constraints (`max-w-7xl`). |

---

## 4. Homepage Blueprint & Conversion Flow

The homepage (`apps/client/src/app/page.tsx`) implements a proven e-commerce conversion funnel:

```text
1. Header & Omnibar          ─── Sticky navbar, Live OpenSearch, Theme toggle, Notification bell, Cart
2. Hero Banner Showcase      ─── GSAP animated carousel with vouchers & trust guarantees
3. Trust Badges              ─── 5-pillar buyer confidence indicators (Protection, Global Delivery, Returns)
4. Marketplace Categories    ─── 6-department visual discovery grid (with resilient fallback)
5. Flash Deals Section       ─── Live countdown timer, stock progress meters, -25% discount claims
6. Editor's Featured Picks   ─── Curated premium carousel with ratings & compare-at pricing
7. All-Time Best Sellers     ─── High-velocity top-rated marketplace selections
8. ShopCTA Promotional Call  ─── VIP $20 coupon code (LAREK20), click-to-copy, category chips
9. New Arrivals Shelf        ─── Latest season arrivals with "NEW" indicator badges
10. Full Catalog Grid        ─── Filterable multi-facet product discovery with pagination
11. Verified Buyer Reviews   ─── 45k+ reviews summary, 4.9/5 stars, verified purchase spotlight
12. AI Recommendation Shelves─── Trending styles & recently viewed carousels
13. Global Directory Footer  ─── VIP newsletter subscription, customer service, SSL guarantees
14. Floating ScrollToTop     ─── Scroll progress bar + interactive circular progress button
```

---

## 5. Component Design Specifications

### 5.1 Omnibar Header & Search (`Navbar.tsx`, `SearchBar.tsx`)

- **Top Utility Bar**: Displays destination delivery status, 100% buyer protection guarantee, currency switcher (`USD $ • EN`), and quick order tracking.
- **Center Omnibar**: Debounced OpenSearch input (`250ms`) with dynamic dropdown showing recent search history pills with 1-click clearance, rich product suggestions with thumbnails, brand tags, and pricing.
- **Mobile Horizontal Ribbon**: Smooth swipeable pill strip on `< 640px` devices providing instant access to Super Deals, Trending, and top departments.
- **Animated Theme Toggle (`ThemeToggleAnimated.tsx`)**: High-contrast icon transitions between Sun and Moon states with persistent storage and zero hydration mismatch.

### 5.2 Hero Banner Sequence (`HeroBanner.tsx`)

- **Main Showcase Banner**: Multi-slide animated carousel driven by `useGSAP` timeline choreography (`power3.out` entrance for badges, headings, CTAs, and verified seller stats).
- **Ambient Lighting**: Dual blur overlays (`bg-indigo-500/20` and `bg-rose-500/10 blur-3xl`) creating depth.
- **Side Promotional Panels**: Marketplace welcome vouchers (`$15 Off Your First Order`) and 30-day buyer protection escrow guarantees.

### 5.3 Flash Deals & Countdown (`FlashDeals.tsx`)

- **Real-Time Countdown Ticker**: Live `HH:MM:SS` timer styled with high-contrast mono pills (`bg-slate-900` and pulse `bg-rose-600`).
- **Stock Depletion Progress**: Linear progression bar displaying `% Sold` to drive purchase urgency.
- **Resilient Fallback**: Built-in `FALLBACK_FLASH_PRODUCTS` conforming to `@repo/types` ensuring the deal showcase always renders even before catalog services finish seeding.

### 5.4 Marketplace Categories (`MarketplaceCategories.tsx`)

- **Category Tiles**: Visual department cards with distinct color themes, Lucide icons, product item counters, and smooth hover lifts (`hover:-translate-y-1`).
- **Resilient Fallback**: Built-in `FALLBACK_CATEGORIES` ensuring the grid never collapses to empty `null` blocks during cold starts.

### 5.5 Featured & Best-Seller Showcases (`FeaturedSection.tsx`)

- **Product Surfaces**: Glassmorphic cards with Star ratings, review counters, compare-at prices, and quick view overlays.
- **Zero-Collapse Fallback**: Curated `FALLBACK_PRODUCTS` for `featured`, `new-arrivals`, and `best-sellers`.

### 5.6 ShopCTA Voucher Banner (`ShopCTA.tsx`)

- **Visual Design**: Ambient obsidian glassmorphic gradient with electric indigo and purple lighting.
- **Interactive Coupon**: 1-click copy action for coupon code `LAREK20` with immediate toast notification feedback.
- **Quick Links**: Category shortcut chips leading directly into `/products?category=...`.

### 5.7 Verified Buyer Testimonials (`Testimonials.tsx`)

- **Social Proof**: 45,000+ verified customer reviews indicator, aggregate `4.9 / 5` star rating.
- **Buyer Spotlight Card**: Detailed testimonial highlighting verified purchase badge, date, and product reference.
- **Review Feed**: Vertical review cards showcasing high customer satisfaction across delivery and quality.

### 5.8 Slide-Over Drawers (`CartDrawer.tsx`, `WishlistDrawer.tsx`)

- **Physics**: Framer Motion spring physics (`damping: 30, stiffness: 300`).
- **Glassmorphic Obsidian**: `dark:bg-[#0b0f19]/95 backdrop-blur-2xl` with inner border reflections.
- **List Choreography**: `<AnimatePresence mode="popLayout">` smoothly animating item dismissals.

### 5.9 Quick-View Modal (`QuickViewModal.tsx`)

- **Modal Dynamics**: Scale-up spring entrance (`scale: 0.94 -> 1`) on `AnimatePresence`.
- **Glassmorphic Dialog**: `rounded-3xl` container with inner sheen and `backdrop-blur-md`.
- **Interactive Variant Selection**: Color swatch previews, size buttons, quantity steppers, and 1-click cart addition.

### 5.10 Modern Checkout & Shipping Flow (`ShippingForm.tsx`, `CodConfirmationForm.tsx`, `StripePaymentForm.tsx`)

- **Card-Style Inputs**: Replaced legacy underlines with modern `rounded-xl` glassmorphic input cards (`bg-white dark:bg-slate-900/60`, border reflections, smooth focus rings).
- **Responsive 2-Col Grid**: Compact paired layout for (Full Name, Email) and (Phone Number, City).
- **Saved Address Selector**: Glassmorphic selection cards with default address badges and active ring highlights.
- **Cash on Delivery Toggle**: Emerald ambient glow card (`bg-emerald-500/10`) with smooth switch indicator.
- **Carrier Delivery Options**: Interactive cards with carrier badges (TCS, Leopards, DHL), delivery estimates, live pricing, and selected check states.
- **COD Confirmation Receipt**: `rounded-3xl` glassmorphic order confirmation card with animated checkmark and direct shipment tracking links.

### 5.11 Smooth Scroll Engine & ScrollToTop (`ScrollToTop.tsx`, `use-lenis.ts`)

- **Viewport Progress Bar**: `h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500` pinned to top viewport indicating scroll depth.
- **Floating Action Button**: Glassmorphic button with SVG circular progress ring, hover halo glow, dynamic scroll percentage tooltip, and accessible keyboard controls.
- **Dual Engine**: Compatible with native window scrolling and Lenis smooth scrolling.
- **Route Navigation**: Automatically resets scroll position on route change via `usePathname()`.

### 5.12 Editorial Directory Footer (`Footer.tsx`)

- **Typography & Scramble FX**: Scoped Google Font `Barlow Condensed` with animated `ShuffleText` scramble effect running via `requestAnimationFrame` on a periodic loop.
- **Massive Brand Showcase**: Heroic brand container bounded by 4-corner bracket accents featuring responsive massive `LAREKMART` scramble typography.
- **Navigation & Departments**: Spring-hover magnetic micro-interactions (`whileHover={{ x: 10 }}`) across Navigation, Marketplace Departments, and Social links.
- **Real-Time Clock & Safe Checkout**: Live UTC operations clock, VIP newsletter subscription with toast feedback, and guaranteed safe checkout badges (`STRIPE`, `VISA`, `MASTERCARD`, `APPLE PAY`, `COD`).

---

## 6. Motion & Animation Principles

| Animation Type           | Technology                   | Scope & Rules                                                                                                                                                         |
| :----------------------- | :--------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Smooth Scrolling**     | **Lenis Scroll Engine**      | Inertia-based smooth scrolling across storefront pages, with `requestAnimationFrame` cleanup on unmount.                                                              |
| **Hero Sequences**       | **GSAP (`useGSAP`)**         | Complex multi-element coordinated timelines and banner auto-advancement. Cleaned up via GSAP context.                                                                 |
| **Interactive Overlays** | **Framer Motion**            | Strictly client-side overlays (`CartDrawer`, `WishlistDrawer`, `QuickViewModal`, checkout steps).                                                                     |
| **Scroll Progress**      | **rAF Throttled Native**     | Real-time calculation of scroll metrics with zero frame drops or re-render churn.                                                                                     |
| **Static Listing Grids** | **Tailwind GPU Transitions** | High-cardinality SSR grids (`ProductCard`, `CategoriesClient`). NEVER use `motion.button` or `layoutId` on static SSR cards to prevent React 19 attribute mismatches. |

---

## 7. Touch, Usability & Accessibility (a11y) Standards

1. **Touch Target Sizing**:
   - All interactive controls (buttons, swatches, quantity steppers, and menu links) maintain a minimum target area of `40x40px` (or `44x44px` on primary actions).
2. **Accessible Form Controls**:
   - Search inputs utilize `role="combobox"`, `aria-autocomplete="list"`, and `aria-expanded`.
   - Modals trap focus and bind the `Escape` key for rapid dismissal.
3. **Contrast Ratios**:
   - High-contrast body text (`text-slate-900 dark:text-white`) and subdued secondary text (`text-slate-500 dark:text-slate-400`) conform to WCAG AA standards.
4. **Resilient Hydration**:
   - All client storage reads are wrapped in `isMounted` or `typeof window !== "undefined"` guards to ensure pristine SSR output and prevent Node 22 runtime warnings.
