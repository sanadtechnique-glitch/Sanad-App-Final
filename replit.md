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

## Project: سند · Sanad

A premium delivery app for Ben Guerdane. **App name**: سند (Sanad). **Slogan**: "سندك في التوصيل.. لباب الدار". **Theme**: Golden Orange (#FFA500) page/nav backgrounds, Forest Green (#2E7D32) for ALL text, icons, slogans, and primary buttons (white text on green buttons), White (#FFFFFF) input backgrounds with Orange (#FFA500) borders, Yellow (#FFD700) tab indicators. **Logo**: Arabic "سند" + "Sanad" BOTH in #2E7D32 dark green, dark green map pin above ن and above 'n' in Sanad, on #FFF3E0 light-cream background. Arabic/French bilingual RTL.

### Architecture

- `artifacts/api-server` — Express API server on port 8080, routes mounted at `/api/*`
- `artifacts/digital-city` — React + Vite frontend, proxies `/api/*` to port 8080
- `lib/db` — Drizzle ORM schema + migrations
- `lib/api-client-react` — Generated TanStack Query hooks (Orval codegen)

### Role & Privilege System

5 roles in the system (`lib/db/src/schema/users.ts` → `users` table):
- `super_admin` — full access to all admin sections including user management
- `manager` — access to overview, orders, hotel bookings, and banners only
- `provider` — access to their own products (provider dashboard)
- `driver` — access to assigned orders (delivery dashboard)
- `customer` — standard browsing/ordering access

Default admin user: username=`admin`, password=`Abc1234`, role=`super_admin`

Admin login flow: POST `/api/auth/admin-login` → returns user (without password) → set session → navigate to `/admin`
User CRUD API: `GET/POST /api/admin/users`, `PATCH/DELETE /api/admin/users/:id`

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

### Public vs Admin API Endpoints — IMPORTANT

Several endpoints were split into public (customer-safe) and admin-only versions:

| Endpoint | Auth | Used by |
|----------|------|---------|
| `GET /api/suppliers` | None (public) | provider.tsx, services page |
| `GET /api/suppliers/:id` | None (public) | provider-store.tsx |
| `PATCH /api/provider/:id/toggle` | requireStaff | provider.tsx (availability toggle) |
| `GET /api/delegations` | None (public) | order.tsx |
| `GET /api/admin/delivery-staff` | requireStaff | delivery.tsx (drivers allowed) |
| `GET /api/admin/suppliers` | requireAdmin | admin.tsx only |

The driver dashboard role check: `session.role === "driver" || session.role === "delivery"` (both supported).

### Login/Auth — Phone-Based, Unified, ENFORCED

**ALL routes are protected.** Unauthenticated users are redirected to `/login` from any URL (enforced via `ProtectedRoute` in `App.tsx`).

**Login Page** (`/login`): Clean form with ONLY phone number + password fields. No username. No selection lists.
**Signup Page** (tab): Phone (required, unique ID), full name, delegation dropdown, password.

**Unified endpoint** `POST /api/auth/login`:
- Accepts `{ phone, password }` for ALL roles
- Searches by phone first; falls back to username for legacy accounts
- Returns `{ role, name, token, supplierId? (provider), staffId? (driver) }`
- Role-based redirect: `super_admin/manager/admin` → `/admin`; `provider` → `/provider`; `driver` → `/delivery`; `customer` → `/`

**No selection lists**: Provider dashboard auto-loads from session.supplierId. Driver dashboard auto-loads from session.staffId. If not linked → shows "not linked" error + logout button.

Session: `DcSession { role, name, userId, token, supplierId?, staffId?, delegationFee?, delegationName? }` in `localStorage` key `dc_session` via `src/lib/auth.ts`.

**Test phone numbers**: admin=`21600000001`, provider=`27 777 002`, driver=`21600000003`, customer=`21600000099`

### Notification System (Client)

`src/lib/notifications.tsx` — `NotificationsProvider` + `useNotifications()` hook. Stores in `localStorage` key `dc_notifications`. Polls every 2.5s for cross-page updates.
- **Bell icon** in client layout header (desktop + mobile), shows green badge with unread count
- Click bell → dropdown showing up to 30 recent notifications; marks all as read
- **Trigger 1**: Provider accepts order → `pushNotification({type:"accepted",...})` written to `dc_notifications`
- **Trigger 2**: Delivery marks as delivered → `pushNotification({type:"delivered",...})` written
- Client bell picks up notifications on next poll cycle (max 2.5s delay)

### Delegation in Sign-Up

Sign-up form fetches `GET /api/admin/delegations`. Shows a **المعتمدية** dropdown (styled Jumia theme, cream background, green border on select). Default: auto-selects **بنقردان / Ben Gardane** (or first in list). Shows delivery fee in DT below the dropdown.
On signup: `delegationId`, `delegationFee`, `delegationName` saved to `DcSession` in localStorage.
Seeded delegations (7): Ben Gardane 3 DT, Zarzis 5 DT, Médenine 6 DT, Djerba Houmt Souk 8 DT, Djerba Midoun 8 DT, Sidi Makhlouf 4.5 DT, Béni Khedache 7 DT.

### Global Cart (Customer)

`src/lib/cart.tsx` — React Context wrapping all routes (via `App.tsx` CartProvider). Cart persists in `localStorage` key `dc_cart`.
- `CartState { supplierId, supplierName, items[], deliveryFee }`
- Cart button shown in BOTH mobile and desktop **top header bars** (top-right position). On desktop there is also a sticky top header (dark mustard) with the cart button showing total price + item count badge.
- Cart drawer uses `session.delegationFee` for delivery fee if set (overrides `cart.deliveryFee`). Shows delegation name badge next to "التوصيل" row.
- Cart is **automatically cleared** after a successful order placement (`clearCart()` called in `order.tsx` `onSubmit`)
- Order form pre-fills `delegationId` from `session.delegationId` (via `setValue`) and `customerName` from `session.name`
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

### Intelligent Logistics & Navigation System

**Distance Calculation** (`artifacts/api-server/src/lib/distance.ts`):
- Algorithm: Haversine formula × 1.35 road factor (no API key needed)
- Optional upgrade: Set `GOOGLE_MAPS_API_KEY` env var → uses Google Maps Distance Matrix API
- Formula: `2 TND base + 0.5 TND/km`, ETA: `15 min prep + (distance/0.5 km/min)`
- Endpoint: `GET /api/distance?providerId=X&customerLat=Y&customerLng=Z` → `{distanceKm, etaMinutes, deliveryFee, source}`

**Schema Changes**:
- `service_providers`: Added `latitude` (real), `longitude` (real) — GPS coordinates for distance calc
- `orders`: Added `customerLat` (real), `customerLng` (real), `distanceKm` (real), `etaMinutes` (integer)

**Customer Order Flow** (`order.tsx`):
- GPS button "استخدم موقعي الحالي" — captures browser GPS via Geolocation API
- Shows delivery fee + ETA card BEFORE order confirmation (3 boxes: KM / TND / min)
- GPS coordinates stored in order on submission, fee calculated server-side

**Customer Order History** (`order-history.tsx`):
- ETA badge `~X دقيقة` shown for active orders (pending, driver_accepted, in_delivery...)

**Driver Navigation** (`delivery.tsx`):
- "الملاحة إلى المزود 🗺️" button on waiting-for-pickup orders → Google Maps deep link to provider
- "الملاحة إلى العميل 🗺️" button on in-delivery orders → Google Maps deep link to customer GPS coords
- Opens native Google Maps app on mobile with fastest route pre-calculated

**Admin Live Map** (`admin.tsx` → LiveMapSection):
- New sidebar section "الخريطة المباشرة / Carte live"
- Leaflet.js + OpenStreetMap (free, no API key)
- Orange pins = active customer orders; Green pins = providers with GPS
- Popup shows: customer name, provider, distance, ETA, fee
- Auto-refreshes every 15 seconds
- Lists orders without GPS separately below the map

**Admin Supplier Form**:
- GPS coordinates section added: Latitude + Longitude inputs
- Ben Guerdane defaults: 33.1167, 11.2167

### Delivery Commission Scenario (عمولة التوصيل)

**DB Table**: `delivery_config` (singleton row, id=1) — `lib/db/src/schema/deliveryConfig.ts`

**Parameters**:
| Field | Default | Description |
|---|---|---|
| `baseFee` | 2.0 TND | Fixed fee per order |
| `ratePerKm` | 0.5 TND/km | Distance rate |
| `minFee` | 2.0 TND | Minimum delivery fee cap |
| `maxFee` | null | Maximum fee cap (null = no cap) |
| `nightSurchargePercent` | 0% | Surcharge during night hours |
| `nightStartHour` | 22 | Night start (24h clock) |
| `nightEndHour` | 6 | Night end (24h clock) |
| `platformCommissionPercent` | 0% | Platform's cut (informational) |
| `prepTimeMinutes` | 15 | Preparation time for ETA |
| `avgSpeedKmPerMin` | 0.5 | Speed for ETA (0.5 = 30 km/h) |
| `expressEnabled` | false | Enable express delivery option |
| `expressSurchargeTnd` | 1.0 TND | Express delivery extra fee |

**Fee Formula**: `max(min(baseFee + ratePerKm×km + nightSurcharge + expressFee, maxFee), minFee)`

**API Endpoints**:
- `GET /api/delivery-config` — Public, returns current config (read by order pages)
- `PATCH /api/admin/delivery-config` — Admin only, updates config + invalidates cache

**Cache**: Config cached in memory 60 seconds to avoid per-request DB hits.

**Admin UI**: New sidebar section "عمولة التوصيل / Commission" (super_admin only):
- 3-column layout: Base Fees / Surcharges & Commission / ETA + Live Preview
- Live calculator slider (0.5–20 km) with night/express checkboxes
- Shows fee breakdown: base + km + night + express + platform commission + ETA

### DB Push Command

```
pnpm --filter @workspace/db run push
```

## Lawyer Request System (New)

### Overview
Full lawyer consultation request flow: customer browses lawyers → selects one → submits a form → lawyer accepts/rejects.

### DB Table: `lawyer_requests`
- `id` serial PK
- `customerId` integer (nullable, linked to user)
- `customerName`, `customerPhone` — required
- `lawyerId` integer (links to service_providers with category="lawyer")
- `lawyerName` text
- `caseType` enum: criminal/civil/administrative/commercial/family/real_estate/other
- `court` text — the competent court name
- `photos` text (JSON array of image URLs stored in `/uploads/lawyer-docs/`)
- `notes` text
- `status` enum: pending/accepted/rejected
- `createdAt`, `updatedAt`

### Frontend Page: `/lawyer`
- Lists all service_providers with category="lawyer"
- Shows availability badge, rating, description, phone
- Tap a lawyer → slide-up form modal:
  - Customer name & phone (pre-filled from session)
  - Case type (7 categories, grid selection)
  - Court name (text input)
  - Optional notes (textarea)
  - Optional photos (up to 5, uploaded to `/api/lawyer-requests/upload`)
- Submit → POST /api/lawyer-requests
- History tab shows customer's own past requests with status

### Provider Dashboard
- If category="lawyer", the SOS tab is replaced with "قضايا/Dossiers" tab
- Shows all requests for that lawyer with Accept/Reject buttons
- Clicking a document photo opens a full-screen preview

### Admin Panel
- New sidebar section: تزويد الخدمات → طلبات المحامين (super_admin only)
- Filter by status: all/pending/accepted/rejected
- Admin can also Accept/Reject requests

### API Endpoints
- `GET /api/lawyers` — public, returns all service_providers with category="lawyer"
- `POST /api/lawyer-requests/upload` — public, stores photo in /uploads/lawyer-docs/
- `POST /api/lawyer-requests` — public, submit a new request
- `GET /api/lawyer-requests/my-customer/:customerId` — customer's own requests
- `GET /api/lawyer-requests/my/:lawyerId` — requireAuth, lawyer's requests
- `GET /api/admin/lawyer-requests` — requireAdmin, all requests
- `PATCH /api/lawyer-requests/:id/status` — requireAuth, accept or reject

### Adding Lawyers
Lawyers are added as suppliers (service_providers) with category="lawyer" via the admin panel (تزويد المنتوجات → المزودون). They login with role="provider" and their supplierId must be set.

## Email Authentication & Password Reset System

### Password Security
- Passwords are now hashed with bcrypt (12 salt rounds) using `bcryptjs`
- Hashing utility in `artifacts/api-server/src/lib/crypto.ts` — `hashPassword()` / `verifyPassword()`
- `verifyPassword()` auto-detects legacy plain-text passwords (prefix `$2b$`/`$2a$` = bcrypt) and logs in fine
- **All new passwords** (signup, admin-create, admin-update, password reset) are stored as bcrypt hashes
- **Existing plain-text passwords** still work on login (backward compatible)

### Forgot Password / Reset Flow
DB table: `password_reset_tokens` (userId, token, expiresAt — 1 hour TTL)

API endpoints:
- `POST /api/auth/forgot-password` — public. Accepts `{ email }`. Creates secure 64-char hex token, stores in DB, sends email. Always returns 200 (anti-enumeration).
- `GET /api/auth/validate-reset-token?token=XYZ` — public. Returns `{ valid: bool }`.
- `POST /api/auth/reset-password` — public. Accepts `{ token, password }`. Validates token expiry, hashes new password, deletes token.

Email service: `artifacts/api-server/src/lib/mailer.ts` using `nodemailer`.
- If `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` env vars are set → real email sent
- Otherwise (development) → reset URL logged to console AND returned in `devResetUrl` field of the API response

### Frontend Changes
- **Login page**: "نسيت كلمة السر؟ · Mot de passe oublié ?" link → opens `ForgotPasswordModal`
- **Signup form**: Email field now mandatory (required) with format validation
- **Route `/reset-password`**: Token validation → password form → success → redirect to `/auth`

### SMTP Configuration (to enable real emails)
Set environment variables: `SMTP_HOST`, `SMTP_PORT` (default 587), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
Optional: `FRONTEND_URL` for the reset link base URL (defaults to REPLIT_DOMAINS)

## Payment Methods System (Complete)

### Overview
Three payment modes: COD (Cash on Delivery), D17 wallet transfer, and Card (placeholder for future).

### DB Schema (`lib/db/src/schema/orders.ts`)
- `paymentMethod` — text, default `'cod'` (`cod` | `d17` | `card_placeholder`)
- `paymentStatus` — text, default `'paid'` (`paid` | `pending_verification` | `verified` | `rejected` | `pending`)
- `paymentReceiptUrl` — text, nullable (screenshot uploaded by customer for D17)

### Payment Status Logic
- `cod` → paymentStatus `'paid'` (immediate, no action needed)
- `d17` → paymentStatus `'pending_verification'` (admin must verify receipt)
- `card_placeholder` → paymentStatus `'pending'` (future feature)

### API Endpoints
- `GET /api/payment-info` — public, returns `{ d17WalletNumber, d17InstructionsAr, d17InstructionsFr }` from `appSettings`
- `PATCH /api/admin/orders/:id/verify-payment` — requireAdmin, `{ action: "approve"|"reject" }` → updates `paymentStatus`
- `PATCH /api/admin/app-settings/bulk` — requireAdmin, `{ settings: [{ key, value }] }` → bulk upsert app settings

### Frontend: Customer (`order.tsx`)
- Payment method selector (3 cards: Cash / D17 / Card placeholder)
- D17: shows wallet number + instructions from API; receipt upload required (blocks submit if missing)
- COD: green confirmation chip
- Card: coming soon notice

### Admin Dashboard: `OrdersSection`
- Payment method + payment status badges on each order card
- D17 orders show receipt image thumbnail with approve ✓ / reject ✗ buttons
- "D17 à vérifier" quick-filter button with pending count badge

### Admin Config: `DeliveryConfigSection`
- D17 wallet number input + bilingual instructions textarea
- Saved to `appSettings` table keys: `d17_wallet_number`, `d17_instructions_ar`, `d17_instructions_fr`

---

## D17 Receipt OCR — Automatic Subscription Renewal

### Overview
Vendors can renew their monthly subscription by uploading a D17 payment receipt screenshot. Gemini Vision AI automatically extracts and validates the receipt details.

### New Database Table (`lib/db/src/schema/d17Receipts.ts`)
- `d17_receipts` — tracks uploaded receipts and their validation status
- Fields: `supplierId`, `imageUrl`, `transactionId`, `amount`, `receiptDate`, `extractedText`, `status`, `rejectionReason`, `createdAt`
- Status values: `pending` | `approved` | `rejected` | `manual_review`

### Gemini AI Integration
- Package: `@workspace/integrations-gemini-ai` (lib/integrations-gemini-ai)
- Model: `gemini-2.5-flash` with vision capability (inline base64 image)
- Env vars: `AI_INTEGRATIONS_GEMINI_BASE_URL`, `AI_INTEGRATIONS_GEMINI_API_KEY` (auto-provisioned)

### Validation Rules
- Amount must match `provider.subscriptionFee` (±0.02 DT tolerance)
- Date must be today (Tunisia timezone UTC+1)
- Transaction ID must be unique (no previously approved receipt with same ID)
- If OCR not confident → `manual_review` status (admin notified via push)

### API Endpoints (`artifacts/api-server/src/routes/d17Renewal.ts`)
- `POST /api/provider/:id/subscription/d17-renew` — multer image upload, OCR, validate, approve/flag
- `GET /api/provider/:id/subscription/d17-history` — provider's receipt history
- `GET /api/admin/d17-receipts` — all receipts (admin only)
- `PATCH /api/admin/d17-receipts/:id/approve` — manual approval (extends +30 days)
- `PATCH /api/admin/d17-receipts/:id/reject` — rejection with reason

### Provider UI (`artifacts/digital-city/src/pages/provider.tsx`)
- New "اشتراك · Abonn." tab with `CreditCard` icon (orange warning dot if expired)
- `D17RenewalPanel` component: subscription status card, upload zone, history list
- Camera-first file input (`capture="environment"`)
- Submit triggers Gemini OCR; shows result banner (approved/rejected/manual_review)

### Admin UI (`artifacts/digital-city/src/pages/admin.tsx`)
- New "وصولات D17 · Reçus D17" section in "Produits & Livraison" nav group (super_admin only)
- `D17ReceiptsSection` component with filter (all/manual_review/approved/rejected)
- Approve button → extends subscription +30 days, notifies vendor via push
- Reject button → shows reason input, updates status
