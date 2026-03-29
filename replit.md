# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Project: المدينة الرقمية (Digital City)

A premium delivery app for Ben Guerdane. **Jumia-inspired theme**: Mustard Yellow (#E1AD01) background, Light Green (#66BB6A) accent/buttons, Dark Green (#004D40) text, Cream (#FFFDE7) cards, Dark Mustard (#C99900) panels/nav/sidebar. Arabic/French bilingual RTL.

### Architecture

- `artifacts/api-server` — Express API server on port 8080, routes mounted at `/api/*`
- `artifacts/digital-city` — React + Vite frontend, proxies `/api/*` to port 8080
- `lib/db` — Drizzle ORM schema + migrations
- `lib/api-client-react` — Generated TanStack Query hooks (Orval codegen)

### API Base URL

All API routes are mounted at `/api` prefix. In `main.tsx`, `setBaseUrl("/api")` is called so the generated client uses the correct prefix. The Vite proxy forwards `/api/*` → `http://localhost:8080`.

### Pages

| Route | Description |
|-------|-------------|
| `/` | Home page — hero, category grid, quick stats |
| `/services` | Services listing with category filter |
| `/store/:id` | Customer-facing product grid (1:1 image, cart, order) |
| `/order/:id` | Customer order form (accepts `?notes=` param from store) |
| `/hotel/:id` | Hotel booking form |
| `/admin` | Admin dashboard — password protected (`admin2024`), gold logout in sidebar |
| `/provider` | Provider dashboard — name-select login, gold logout button |
| `/delivery` | Delivery staff dashboard — name-select login, gold logout button |

### Login/Auth (Unified) — ENFORCED

**ALL routes are protected.** Unauthenticated users are redirected to `/login` from any URL (enforced via `ProtectedRoute` in `App.tsx`).

- `/login` — Public. If already logged in, auto-redirects to role home.
- **Admin**: username `admin` (any password) → `/admin`
- **Provider**: username matches supplier nameAr or name in DB → `/provider`
- **Delivery**: username matches delivery staff nameAr or name in DB → `/delivery`
- **Client**: any name + any password → `/` (home)
- Session: `DcSession { role, name, supplierId?, staffId? }` in `localStorage` key `dc_session` via `src/lib/auth.ts`.
- Logout button in layout (desktop sidebar + mobile bottom nav) clears session → `/login`.

### Global Cart (Customer)

`src/lib/cart.tsx` — React Context wrapping all routes (via `App.tsx` CartProvider). Cart persists in `localStorage` key `dc_cart`.
- `CartState { supplierId, supplierName, items[], deliveryFee }`
- Cart button shown in BOTH mobile and desktop **top header bars** (top-right position). On desktop there is also a sticky top header (dark mustard) with the cart button showing total price + item count badge.
- Cart drawer slides in from the side with item list, qty controls, subtotal + delivery fee + total
- "Passer la commande" → navigates to `/order/:supplierId?notes=<cart_summary>`
- Adding item from a different supplier clears the old cart

### Provider Store (Customer Product Grid)

`/store/:id` — Uses global cart context. Products in 2–4 col grid with 1:1 aspect ratio, gold border on black. Each card has name, price, +/- qty controls and "إضافة للسلة" button. Cart managed globally and accessible from Layout cart icon.

### Admin Dashboard Sections (9)

1. **نظرة عامة / Vue d'ensemble** — Stats + recent orders + active suppliers
2. **الطلبات / Commandes** — Full order management with status update, staff assignment, WhatsApp
3. **الفئات / Catégories** — CRUD for service categories
4. **المزودون / Fournisseurs** — CRUD for suppliers with pharmacy shift (day/night/all), toggle availability
5. **المنتجات / Articles** — CRUD for articles with original/discounted pricing
6. **السائقون / Livreurs** — CRUD for delivery staff
7. **المعتمديات / Délégations** — CRUD for zones with per-zone delivery fees
8. **الإعلانات / Publicités** — CRUD for promo banners with color picker and date range

### Database Tables

`service_providers`, `orders`, `categories`, `articles`, `delegations`, `delivery_staff`, `promo_banners`, `ratings`, `hotel_bookings`

### Key Rules

- **NEVER show phone numbers** in the customer-facing app (`/`, `/services`, `/order`). Phones are only for admin/provider/delivery WhatsApp integration.
- **Jumia color palette**: BG `#E1AD01` (mustard), panels `#C99900` (dark mustard), cards `#FFFDE7` (cream), accent `#66BB6A` (green), text `#004D40` (dark green).
- Fonts: Tajawal (Arabic) + Outfit (French/Latin).
- Language: AR/FR toggle in localStorage, RTL layout switches via `document.documentElement.dir`.

### Order Status Flow

`pending → accepted → prepared → in_delivery → delivered | cancelled`

- **pending**: Customer placed order, awaiting provider action
- **accepted**: Provider accepted → shows "Prêt pour livraison" gold button
- **prepared**: Provider marked order as ready → appears in delivery pool
- **in_delivery**: Delivery staff took the order → shows "Livré ✓" + "Refuser" buttons
- **delivered**: Order completed
- **cancelled**: Provider rejected the order

### RBAC per Dashboard

| Role | Sees | Can Do |
|------|------|--------|
| Admin | All orders, providers, staff, articles, delegations | Full CRUD |
| Provider | Only their own supplier's orders | Accept, Reject, Mark as Prêt |
| Delivery | Only `prepared` orders in pool | Claim (→ in_delivery), Livré, Refuser (→ back to prepared) |
| Client | Public pages: home, services, store | Browse, add to cart, place order |

### Languages

Arabic (RTL) and French (LTR). `useLang()` hook provides `lang`, `t(ar, fr)`, `isRTL`.

### Admin API Helper

`src/lib/admin-api.ts` — simple fetch wrapper with `BASE = "/api"` prefix. Used by all admin/provider/delivery pages (NOT by the generated client which handles its own prefix via `setBaseUrl`).

### Pharmacy Shifts

Suppliers with `category === "pharmacy"` have a `shift` field: `"day"`, `"night"`, `"all"`. Used for automatic display filtering.

### DB Push Command

```
pnpm --filter @workspace/db run push
```
