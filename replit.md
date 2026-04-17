# Overview

This project is a premium delivery application named "سند · Sanad" designed for Ben Guerdane. It aims to provide efficient delivery services with a localized user experience. The application encompasses customer ordering, provider management, delivery staff operations, and extensive administrative functionalities. Its vision is to be the leading delivery platform in its target region, offering a comprehensive suite of services from product delivery to specialized consultations like legal services, and hotel bookings.

# User Preferences

I prefer concise and accurate responses. When making changes, prioritize modularity and reusability. For critical architectural decisions, ask for confirmation. Ensure all user-facing text is available in both Arabic (RTL) and French (LTR). Adhere strictly to the defined color palette and typography. Do not make changes to files or folders that are not directly relevant to the current task.

# System Architecture

The project is structured as a pnpm monorepo using Node.js 24 and TypeScript 5.9.

**Core Technologies:**
- **API Framework:** Express 5
- **Database:** PostgreSQL with Drizzle ORM
- **Validation:** Zod
- **Frontend:** React + Vite
- **API Codegen:** Orval (from OpenAPI spec)
- **Build Tool:** esbuild

**Monorepo Structure:**
- `artifacts/api-server`: Express API server (port 8080, routes at `/api/*`)
- `artifacts/digital-city`: React + Vite frontend, proxies `/api/*` to the API server
- `lib/db`: Drizzle ORM schema and migrations
- `lib/api-client-react`: Generated TanStack Query hooks

**UI/UX Design:**
- **App Name:** سند (Sanad)
- **Slogan:** "سندك في التوصيل.. لباب الدار"
- **Color Palette (Jumia theme):**
    - Golden Orange (`#FFA500`) for page/nav backgrounds, Orange (`#FFA500`) for input borders
    - Forest Green (`#2E7D32`) for all text, icons, slogans, primary buttons (white text on green buttons)
    - White (`#FFFFFF`) for input backgrounds
    - Yellow (`#FFD700`) for tab indicators
    - Background Mustard (`#E1AD01`), panels Dark Mustard (`#C99900`), cards Cream (`#FFFDE7`), accent Green (`#66BB6A`), text Dark Green (`#004D40`)
- **Logo:** Arabic "سند" + "Sanad" in `#2E7D32` dark green, with dark green map pin on a light-cream (`#FFF3E0`) background.
- **Fonts:** Tajawal (Arabic) and Outfit (French/Latin).
- **Language & Layout:** Arabic (RTL) and French (LTR) with a toggle.

**Authentication & Authorization:**
- **Role-Based Access Control (RBAC):** `super_admin`, `manager`, `provider`, `driver`, `customer`.
- **Login:** Phone-based, unified login endpoint (`POST /api/auth/login`) for all roles. All routes are protected.
- **Session Management:** `DcSession` stored in `localStorage`.
- **Password Security:** Passwords are hashed with bcrypt. Legacy plain-text passwords are backward-compatible.
- **Password Reset:** Implemented with email-based token verification.

**Key Features & Implementations:**
- **Global Cart:** React Context-based, persists in `localStorage`, automatically cleared on successful order.
- **Notification System:** Client-side, uses `localStorage` for cross-page updates, polling every 2.5s.
- **Delegation System:** Sign-up form includes a "المعتمدية" dropdown with associated delivery fees.
- **Admin Dashboard:** Comprehensive sections for managing orders, categories, suppliers, products, delivery staff, delegations, and promotional banners.
- **Order Status Flow:** `pending → accepted → prepared → in_delivery → delivered | cancelled`. RBAC applies to status transitions.
- **Intelligent Logistics & Navigation:**
    - **Distance Calculation:** Haversine formula with optional Google Maps Distance Matrix API integration. Calculates delivery fee and ETA.
    - **GPS Integration:** Customer GPS capture for order placement.
    - **Driver Navigation:** Google Maps deep linking for navigation to provider and customer.
    - **Admin Live Map:** Leaflet.js + OpenStreetMap for live tracking of orders and providers.
- **Delivery Commission System:** Configurable delivery fees with base fee, rate per km, min/max fees, night surcharges, and express options. Managed via `delivery_config` table and admin UI.
- **Lawyer Request System:** Full workflow for customers to request consultations from lawyers (suppliers with `category="lawyer"`). Includes form submission, document upload, and lawyer/admin acceptance/rejection.
- **Email Authentication & Password Reset:** Secure password reset flow with email integration using `nodemailer`.
- **Payment Methods System:** Supports Cash on Delivery (COD), D17 wallet transfer (with receipt verification), and a placeholder for card payments.
- **D17 Receipt OCR:** Automatic subscription renewal for vendors using D17 payment receipts. Integrates Gemini Vision AI for OCR and validation, with manual review fallback.

# External Dependencies

- **pnpm workspaces:** Monorepo management.
- **TypeScript:** Language.
- **Express 5:** API framework.
- **PostgreSQL:** Database.
- **Drizzle ORM:** ORM for database interaction.
- **Zod:** Schema validation.
- **drizzle-zod:** Zod integration for Drizzle.
- **Orval:** OpenAPI client code generation.
- **esbuild:** JavaScript bundler.
- **React:** Frontend library.
- **Vite:** Frontend build tool.
- **TanStack Query:** Data fetching and caching.
- **bcryptjs:** Password hashing.
- **nodemailer:** Email sending.
- **Google Maps API:** Optional for distance matrix and navigation deep links (requires `GOOGLE_MAPS_API_KEY`).
- **Leaflet.js & OpenStreetMap:** For admin live map (free, no API key required).
- **Gemini Vision AI:** For D17 receipt OCR and validation (`@workspace/integrations-gemini-ai`). Requires `AI_INTEGRATIONS_GEMINI_BASE_URL` and `AI_INTEGRATIONS_GEMINI_API_KEY`.