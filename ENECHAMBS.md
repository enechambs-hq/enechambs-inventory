# Enechambs Inventory — Frontend Context

## What this project is
Admin dashboard and inventory management system for Enechambs Food — a Nigerian foodstuff business. Cloned and adapted from Lmart (a gadget store frontend). All gadget-specific pages and logic have been removed or are being replaced.

## Stack
- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Zustand (state management via `src/store/`)
- Custom hooks in `src/hooks/`

## Backend
- Base URL (dev): `http://localhost:3000/api/v1`
- Auth: JWT via Bearer token
- Swagger docs: `http://localhost:3000/api/docs`
- Repo: `enechambs-hq/enechambs-api`

## App structure
- `src/app/(auth)/` — login, setup-password pages
- `src/app/(inventory)/` — all dashboard pages (protected routes)
- `src/components/` — shared UI components
- `src/hooks/` — API and state hooks
- `src/store/` — Zustand global state
- `src/types/` — TypeScript interfaces
- `src/constants/` — enums, static values
- `src/lib/` — utilities, axios config

## Modules (backend endpoints available)
- `auth` — login, setup-password, register-staff, change-password
- `inventory` — CRUD for food products
- `categories` — food category management
- `suppliers` — supplier management
- `sales` — record and view sales
- `customers` — auto-created from sales
- `stock-alerts` — products below restock threshold
- `reports` — sales, stock, category reports
- `dashboard` — KPI stats, daily/weekly/monthly
- `users` — staff management
- `activity-logs` — audit trail

## What's been removed (do not recreate)
- collections, credits, incoming-orders pages and components
- IMEI, storageGB, color, condition, thresholdPrice fields
- Any gadget-specific logic

## Inventory product fields
productName, quantity, unit (kg/piece/litre/pack/bag/carton/dozen),
costPrice, sellingPrice, categoryId, supplierRef,
restockThreshold, expiryTracking, expiryDate, dateAdded

## Conventions
- Always use the existing component patterns in `src/components/`
- Always use existing hooks pattern in `src/hooks/` for API calls
- Never use `synchronize: true` or hardcode API keys
- Follow existing Tailwind class patterns — do not introduce new CSS frameworks
- All new pages go inside `src/app/(inventory)/`
- All amounts are in Nigerian Naira (₦)