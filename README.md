# Enechambs Food — Inventory Management Dashboard

Frontend admin dashboard for the Enechambs Food inventory and business management system — a Nigerian foodstuff business. Built with Next.js 14 App Router, TypeScript and Tailwind CSS.

## Features

- 🔐 **Role-based UI** — Admin sees all features; Staff sees a filtered view
- 📦 **Inventory** — Add, edit, restock and delete food products; low-stock alerts; expiry tracking
- 💰 **Sales** — Record single and bulk sales; customer lookup; receipt generation
- 🛒 **Purchases** — Log supplier purchases with cost tracking; monthly totals
- 💸 **Expenses** — Record business expenses by category; monthly spending chart (Admin)
- 📊 **Dashboard** — Live KPIs: available stock, sold today, stock value, cost value
- 📈 **Reports** — Sales, stock, category, profit and monthly P&L (Admin); sales and stock reports (Staff)
- 🗓️ **Monthly P&L** — Set opening stock value (edit-locked after day 7 with admin override)
- 🔔 **Focus refresh** — Dashboard and inventory stats refresh automatically when the tab regains focus
- ⌨️ **Smart inputs** — All money inputs show comma formatting in real time (e.g. 1,000,000); date inputs block future dates

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| State | Zustand |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Toasts | Sonner |
| Deployment | Vercel |

## Architecture

The frontend proxies all API calls through a Next.js API route (`src/app/api/v1/[...path]/route.ts`) to the backend, which runs on Render at `https://enechambs-api.onrender.com`. This keeps the backend URL out of the browser and avoids CORS issues.

## App Structure

```
src/
├── app/
│   ├── (auth)/            # Login, setup-password pages
│   ├── (inventory)/       # All dashboard pages (protected)
│   │   ├── inventory/     # Inventory management
│   │   ├── sales/         # Sales recording and history
│   │   ├── purchases/     # Purchases tracking
│   │   ├── expenses/      # Expense management
│   │   └── reports/       # Business reports
│   └── api/v1/[...path]/  # API proxy to Render backend
├── components/
│   ├── shared/            # InventoryForm, SaleForm, NumericInput, StatCard…
│   ├── inventory/         # Low stock alerts, filters, table
│   ├── dashboard/         # Revenue chart, summary cards
│   └── stock-alerts/      # Restock dialog
├── hooks/                 # useAuthGuard, useAuthStore
├── lib/
│   ├── api.ts             # Axios instance
│   └── services/          # API service layer (one file per module)
├── store/                 # Zustand stores
└── types/                 # TypeScript interfaces
```

## Role Access Summary

| Feature | Admin | Staff |
|---|---|---|
| Inventory — view | ✅ | ✅ |
| Inventory — add / edit / delete | ✅ | ❌ |
| Sales — record / view | ✅ | ✅ |
| Purchases — all | ✅ | ❌ |
| Expenses — view / record | ✅ | ✅ |
| Expenses — edit / delete / summary | ✅ | ❌ |
| Expense categories — view / create | ✅ | ✅ |
| Expense categories — edit / delete | ✅ | ❌ |
| Reports — sales / stock | ✅ | ✅ |
| Reports — category / profit / expenses / P&L | ✅ | ❌ |
| Dashboard KPI cards | ✅ | ✅ |
| Dashboard revenue charts | ✅ | ❌ |

## Getting Started

### Prerequisites
- Node.js 18+
- The `enechambs-api` backend running (locally or on Render)

### Installation

```bash
npm install
```

### Environment variables

```env
NEXT_PUBLIC_API_URL=/api/v1
BACKEND_URL=https://enechambs-api.onrender.com
```

### Development

```bash
npm run dev
```

The app runs on `http://localhost:3001` (or the next available port). API calls are proxied to `BACKEND_URL`.

## Branch Flow

```
feature/* → PR → dev → PR → main (deploy to Vercel)
```

After merging dev → main, `dev` is synced back to `main` to prevent branch divergence.
