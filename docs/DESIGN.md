# UI/UX Design System & Architectural Design (`docs/DESIGN.md`)

This document defines the visual design system, aesthetic standards, component specifications, motion principles, and responsive layout guidelines for the **Larekmart** platform frontends (`apps/client` storefront and `apps/admin` dashboard).

---

## 1. Aesthetic Vision & Design Philosophy

Larekmart delivers a **world-class global marketplace experience**, synthesising the best-converting patterns of premier platforms (AliExpress, Daraz, Amazon, and Alibaba) into a sleek, cohesive, and modern interface:

- **High Trust & Clarity**: Prominent buyer protection guarantees, verified seller badges, transparent shipping calculations, and SSL escrow confidence indicators.
- **Conversion-Optimised Discovery**: Real-time OpenSearch autocomplete, flash deals with live countdown tickers, dynamic stock progress meters, and AI-curated recommendation shelves.
- **Micro-Interaction Polish**: Silky spring-driven drawers, interactive color swatches, full-screen quick-view modals, and timeline-choreographed hero banners.
- **Zero-Compromise Performance**: 60fps hardware-accelerated animations, strictly isolated motion boundaries, and strict SSR hydration equality in React 19 and Next.js 16.

---

## 2. Design Tokens & Theme Foundation

The design system is implemented using **Tailwind CSS v4** tokens and CSS variables configured in `src/app/globals.css`.

### 2.1 Color Palette & Semantic System

| Token Role                | Tailwind Palette              | Purpose & Application                                                                            |
| :------------------------ | :---------------------------- | :----------------------------------------------------------------------------------------------- |
| **Brand Primary**         | `indigo-600` / `indigo-700`   | Primary buttons, active tabs, brand accents, links, and selected radio cards.                    |
| **Surface Dark**          | `slate-900` / `slate-950`     | Top announcement bar, primary footers, dark cards, countdown timers, and typography.             |
| **Surface Neutral**       | `slate-50` / `slate-100`      | Page background, product gallery wells, disabled controls, and chip backgrounds.                 |
| **Borders & Dividers**    | `slate-200/80` / `slate-100`  | Subdued borders, section dividers, card containers, and dropdown outlines.                       |
| **Promotional / Urgency** | `rose-500` / `rose-600`       | Flash deal badges, countdown seconds ticker, discount tags (`-25%`), and wishlist active hearts. |
| **Rating & Highlights**   | `amber-400` / `amber-500`     | Star ratings, promotional vouchers, "New User Bonus" banners, and warning notices.               |
| **Trust & Success**       | `emerald-500` / `emerald-600` | Buyer protection indicators, in-stock badges, free shipping tags, and verified review badges.    |

### 2.2 Typography System

The interface pairs modern Google Fonts loaded via `next/font`:

- **Primary Body & Display**: `Geist Sans` (`--font-geist-sans`) — crisp, modern grotesque typeface offering legibility at dense marketplace scales.
- **Numeric & Code**: `Geist Mono` (`--font-geist-mono`) — used for voucher codes, countdown tickers, order numbers, and tabular data.

#### Typographic Hierarchy

- **Hero Title**: `text-3xl sm:text-5xl font-black tracking-tight leading-tight`
- **Section Heading**: `text-xl sm:text-2xl font-black text-slate-900 tracking-tight`
- **Card Title**: `text-sm font-bold text-slate-900 line-clamp-1`
- **Pricing Headline**: `text-base sm:text-lg font-black text-slate-900`
- **Original Price (Strikethrough)**: `text-xs text-slate-400 line-through`
- **Micro-Badges & Meta**: `text-[10px] sm:text-xs font-bold uppercase tracking-wider`

### 2.3 Radii, Elevation & Glassmorphism

- **Border Radii**:
  - `rounded-lg` / `rounded-xl`: Form controls, buttons, swatch chips, and thumbnails.
  - `rounded-2xl`: Product cards, category cards, and modal dialogs.
  - `rounded-3xl`: Hero banner containers, trust badge strips, and major section wrappers.
  - `rounded-full`: Floating action buttons, status pills, and color swatches.
- **Elevation**:
  - `shadow-xs`: Default card and button elevation.
  - `shadow-md` / `shadow-lg`: Hover elevation for product cards and primary CTAs.
  - `shadow-2xl`: Slide-over drawers (`CartDrawer`, `WishlistDrawer`) and modals.
- **Glassmorphism**:
  - `bg-white/90 backdrop-blur-xs` for floating overlay buttons (wishlist, quick view).
  - `bg-black/50 backdrop-blur-xs` for drawer and modal backdrops.

---

## 3. Responsive Layout Architecture

The storefront is engineered **mobile-first**, scaling gracefully across all form factors:

```text
┌────────────────────────────────────────────────────────┐
│  Mobile (< 640px)                                      │
│  - Single/two-column adaptive product listings         │
│  - Horizontal scrollable category chip strips          │
│  - Full-screen slide-over drawers (Cart & Wishlist)    │
│  - Vertically stacked cart item rows                   │
├────────────────────────────────────────────────────────┤
│  Tablet (640px – 1024px)                               │
│  - 2 to 3 column catalog product grids                 │
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

## 4. Component Design Specifications

### 4.1 Omnibar Header & Search (`Navbar.tsx`, `SearchBar.tsx`)

- **Top Utility Bar**: Displays destination delivery status, 100% buyer protection guarantee, currency switcher (`USD $ • EN`), and quick order tracking.
- **Center Omnibar**: Debounced OpenSearch input (`250ms`) with dynamic dropdown showing recent search history pills, rich suggestions (thumbnails, brands, pricing), and zero-state fallbacks.
- **Mobile Horizontal Ribbon**: Smooth swipeable pill strip on `< 640px` devices providing instant access to Super Deals, Trending, and top departments.

### 4.2 Hero Banner Sequence (`HeroBanner.tsx`)

- **Main Showcase Banner**: Multi-slide animated carousel driven by `useGSAP` timeline choreography (`power3.out` entrance for badges, headings, CTAs, and verified seller stats).
- **Ambient Lighting**: Dual blur overlays (`bg-indigo-500/20` and `bg-rose-500/10 blur-3xl`) creating depth.
- **Side Promotional Panels**: Ali-style welcome vouchers (`$15 Off Your First Order`) and 30-day buyer protection escrow guarantees.

### 4.3 Flash Deals & Countdown (`FlashDeals.tsx`)

- **Real-Time Countdown Ticker**: Live `HH:MM:SS` timer styled with high-contrast mono pills (`bg-slate-900` and pulse `bg-rose-600`).
- **Stock Depletion Progress**: Linear progression bar displaying `% Sold` to drive purchase urgency.
- **SSR Hydration Guard**: Decorated with `suppressHydrationWarning` to prevent client clock mismatch warnings.

### 4.4 Product Cards (`ProductCard.tsx`)

- **Discount & Status Badges**: Top-left discount pill (`-25%`) and "Top Pick" badge.
- **Floating Actions**: Top-right wishlist heart toggle (persistent with `wishlistStore`) and quick-preview eye trigger (accessible on touch screens).
- **Interactive Swatches**: Instant color switching that dynamically updates the preview image without triggering a full page reload.
- **Compact Price Line**: Current price, crossed-out original price, and "Free Shipping" confidence tag.

### 4.5 Slide-Over Drawers (`CartDrawer.tsx`, `WishlistDrawer.tsx`)

- **Physics**: Framer Motion spring physics (`damping: 30, stiffness: 300`).
- **Responsive Width**: `w-screen max-w-full sm:max-w-md` with `pl-0 sm:pl-10`.
- **List Choreography**: `<AnimatePresence mode="popLayout">` smoothly animating item dismissals.

### 4.6 Quick-View Modal (`QuickViewModal.tsx`)

- **Modal Dynamics**: Scale-up spring entrance (`scale: 0.94 -> 1`) on `AnimatePresence`.
- **Scroll Containment**: Constrained with `max-h-[92vh] overflow-y-auto` to ensure seamless scrolling on short mobile displays.
- **Interactive Variant Selection**: Color swatch previews, size buttons, quantity steppers, and 1-click cart addition.

### 4.7 Multi-Step Checkout Workflow (`cart/page.tsx`)

- **Step Indicators**: 3-stage progress ribbon (1. Shopping Cart → 2. Shipping Address → 3. Payment Method).
- **Smooth Step Transitions**: `<AnimatePresence mode="wait">` delivering seamless cross-step motion.
- **Responsive Cart Item Rows**: Automatically adapts between stacked mobile cards and horizontal tablet/desktop rows.

---

## 5. Motion & Animation Principles

| Animation Type           | Technology                   | Scope & Rules                                                                                                                                                         |
| :----------------------- | :--------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hero Sequences**       | **GSAP (`useGSAP`)**         | Complex multi-element coordinated timelines and banner auto-advancement. Cleaned up via GSAP context.                                                                 |
| **Interactive Overlays** | **Framer Motion**            | Strictly client-side overlays (`CartDrawer`, `WishlistDrawer`, `QuickViewModal`, checkout steps).                                                                     |
| **Static Listing Grids** | **Tailwind GPU Transitions** | High-cardinality SSR grids (`ProductCard`, `CategoriesClient`). NEVER use `motion.button` or `layoutId` on static SSR cards to prevent React 19 attribute mismatches. |

---

## 6. Touch, Usability & Accessibility (a11y) Standards

1. **Touch Target Sizing**:
   - All interactive controls (buttons, swatches, quantity steppers, and menu links) maintain a minimum target area of `40x40px` (or `44x44px` on primary actions).
2. **Accessible Form Controls**:
   - Search inputs utilize `role="combobox"`, `aria-autocomplete="list"`, and `aria-expanded`.
   - Modals trap focus and bind the `Escape` key for rapid dismissal.
3. **Contrast Ratios**:
   - All body text and button typography conform to WCAG AA contrast standards against their background tokens.
4. **Resilient Hydration**:
   - All client storage reads are wrapped in `isMounted` guards to ensure pristine SSR output.
