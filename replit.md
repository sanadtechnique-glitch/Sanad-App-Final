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

A premium delivery app for Ben Guerdane with dark mode + gold accent theme.

### Features
- 6 Service categories: Restaurant, Pharmacy, Lawyer, Grocery, Mechanic, Doctor
- Internal ordering system (no phone numbers shown to customers ever)
- Admin dashboard for order management with status updates
- 12 seeded service providers
- Mobile-first design with bottom navigation + desktop sidebar

### Pages
- `/` - Home screen with hero + 6 category cards
- `/services` - Service providers list with category filter
- `/order/:id` - Order form for a specific provider
- `/admin` - Admin dashboard with order management

### API Endpoints
- `GET /api/services?category=` - list providers
- `POST /api/orders` - create order
- `GET /api/orders` - list all orders (admin)
- `PATCH /api/orders/:id` - update order status

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── digital-city/       # React + Vite frontend (المدينة الرقمية)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
│       └── src/schema/
│           ├── serviceProviders.ts
│           └── orders.ts
├── scripts/                # Utility scripts
│   └── src/seed.ts         # Database seeder
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

### `artifacts/digital-city` (`@workspace/digital-city`)

React + Vite frontend for the Digital City delivery app. Uses:
- `@workspace/api-client-react` for API hooks
- `framer-motion` for animations
- `react-hook-form` + `@hookform/resolvers` for order form
- `date-fns` for date formatting

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Tables: `service_providers`, `orders`.

- `pnpm --filter @workspace/db run push` — push schema changes
- Seed: `pnpm --filter @workspace/scripts run seed`
