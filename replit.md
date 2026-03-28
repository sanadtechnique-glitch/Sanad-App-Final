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

A premium delivery app for Ben Guerdane with forced dark mode + gold (#D4AF37) accent theme.

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

### Login/Auth

- **Admin**: Password `admin2024` stored in `localStorage` key `dc_admin_auth`. Gold logout button in sidebar.
- **Provider**: Name selection acts as login. Gold "خروج / Déco." button in dashboard header.
- **Delivery**: Name selection acts as login. Gold "خروج / Déco." button in dashboard header.

### Provider Store (Customer Product Grid)

`/store/:id` — Fetches articles for a supplier via `GET /api/articles?supplierId=X`. Shows products in a 2–4 col grid with 1:1 aspect ratio, gold border on black background. Each card has name, price, +/- qty controls and "إضافة للسلة" button. Floating cart button → cart drawer → `placeOrder()` navigates to `/order/:id?notes=<cart_summary>`.

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
- Dark mode is FORCED — no light mode toggle.
- Gold accent: `#D4AF37`. Fonts: Tajawal (Arabic) + Outfit (French/Latin).
- Language: AR/FR toggle in localStorage, RTL layout switches via `document.documentElement.dir`.

### Order Status Flow

`pending → accepted → in_delivery → delivered | cancelled`

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
