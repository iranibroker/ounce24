# Codebase Architecture Guide - Ounce24

This document describes the overall architecture, tech stack, package manager, directory structure, and core systems of the **Ounce24** platform.

---

## 1. Tech Stack Overview

Ounce24 is built as a TypeScript monorepo using **Nx** for workspace management and **pnpm** as the package manager.

| Layer | Technology | Details / Libraries |
| :--- | :--- | :--- |
| **Workspace & Build System** | [Nx Workspace](https://nx.dev/) (v20.4) | Manages build caching, task execution, and dependency graphing. |
| **Package Manager** | [pnpm](https://pnpm.io/) (v10.34.3) | Fast, disk-efficient package management. |
| **Frontend Framework** | [Angular](https://angular.dev/) (v19.1) | Standard standalone component architecture using Angular Signals for reactivity. |
| **Frontend State & Fetching** | [TanStack Angular Query](https://tanstack.com/query/latest/docs/framework/angular/overview) | For managing server-state, caching, and background queries. |
| **Backend Framework** | [NestJS](https://nestjs.com/) (v10.0) | Modular node framework utilizing decorators, dependency injection, and pipes. |
| **Database** | [MongoDB](https://www.mongodb.com/) via Mongoose | Data persistence for users, signals, scores, and historical gold candles. |
| **Caching & Queueing** | [Redis](https://redis.io/) via `ioredis` | Used for session data and cache management. |
| **Third-Party Integrations** | Telegraf (Telegram Bot), OpenAI, Google Auth, Kavenegar (SMS) | Real-time bots, AI evaluations, authentication, and notifications. |

---

## 2. Workspace Directory Structure

Below is an overview of the key directories in the workspace:

```
ounce24/
├── .agent/                      # AI Agent workspace folder
│   ├── docs/                    # Architectural and integration docs
│   │   └── styleguide.md            # UI Styleguide & Dark Premium Glassmorphism guidelines
│   ├── rules/                   # Specific prompt rules for AI development
│   │   ├── angular.mdc          # Rules for writing modern Angular templates & Signals
│   │   └── market-status-source-of-truth.mdc # Market price & state guidelines
│   └── architecture.md          # [This File] Codebase architecture overview
├── app/                         # Angular Frontend Application
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/      # Reusable UI components
│   │   │   ├── directives/      # Custom Angular directives
│   │   │   ├── guards/          # Route guards (e.g., AuthGuard)
│   │   │   ├── pages/           # High-level route pages (Dashboard, Signals, etc.)
│   │   │   ├── pipes/           # Custom formatting pipes
│   │   │   ├── providers/       # Custom DI providers
│   │   │   ├── services/        # Core services (OuncePriceService, API Clients)
│   │   │   ├── shared/          # Shared components or models
│   │   │   └── shell/           # Application layout/shell wrappers
│   │   └── index.html           # HTML Entry Point
│   ├── project.json             # Nx configuration for the frontend project
│   └── tsconfig.app.json        # TypeScript configuration for the frontend
├── backend/                     # NestJS Backend Application
│   ├── src/
│   │   ├── main.ts              # Express server bootstrap logic
│   │   └── app/
│   │       ├── auth/            # Local, JWT, Google OAuth authentication
│   │       ├── bot/             # Telegram bot logic (nestjs-telegraf)
│   │       ├── ounce-price/     # Gold Spot price adapter & market state source of truth
│   │       ├── octopus/         # Octopus game engine (predictions, leaderboard, stats)
│   │       ├── signals/         # Trading signal analysis & distribution
│   │       ├── podcast/         # Audio/podcast catalog logic
│   │       ├── ai/              # OpenAI API endpoints & analyses
│   │       ├── schemas/         # Mongoose schema definitions (Users, Signals, etc.)
│   │       ├── users/           # User management and profile details
│   │       ├── ounce-alarms/    # Gold price alert configurations
│   │       ├── app-token/       # JWT token issuance & validation helpers
│   │       └── web-push/        # Service-worker push notification management
│   └── project.json             # Nx configuration for the backend project
├── backend-e2e/                 # E2E Test Suite for the Backend APIs
├── docker/                      # Production Deployment Dockerfiles
│   ├── app/                     # Nginx + Angular multi-stage build Dockerfile
│   └── backend/                 # NestJS build Dockerfile
├── types/                       # Shared Domain TypeScript Interfaces (`@ounce24/types`)
├── utils/                       # Shared Utilities & Helpers (`@ounce24/utils`)
├── nx.json                      # Nx Workspace global config
├── package.json                 # Global npm package dependencies & workspace scripts
└── pnpm-lock.yaml               # Lockfile for pnpm dependencies
```

---

## 3. Core Architectural Concepts

### A. Gold Price & Market Status (Single Source of Truth)
A critical rule in Ounce24 is that **all systems must read gold spot prices and market open/close states from the central OuncePriceService**.

*   **Backend (`OuncePriceService`)**: 
    - Streaming WebSocket connection to retrieve gold spot prices (automatically handled/paused by `QuoteService` depending on market status).
    - Exposes `ouncePriceService.current` and `ouncePriceService.isMarketOpen(date)`.
    - Fires event-driven updates (e.g. `EVENTS.MARKET_CLOSED`, `EVENTS.MARKET_OPENED`, `EVENTS.WEEKLY_SIGNALS_RESET`) using `@nestjs/event-emitter` instead of arbitrary calendar cron schedules.
*   **Frontend (`OuncePriceService`)**:
    - Calls `/api/ounce-price/current` on startup.
    - Exposes reactive variables via Angular Signals: `priceService.value()` and `priceService.isMarketOpen()`.
    - No dummy fallback values or client-side polling are allowed.

### B. Monorepo Integration & Paths
Shared logic is separated into libraries so it can be referenced seamlessly in both the backend and frontend without duplicating code. Path aliases are defined in [tsconfig.base.json](file:///Users/mahdi.ketabdar/Developer/ounce24/tsconfig.base.json):
*   `@ounce24/types` maps to `types/src/index.ts`.
*   `@ounce24/utils` maps to `utils/src/index.ts`.

### C. Telegram Bot Infrastructure
The platform operates multiple Telegram bots managed by NestJS:
- **`main` (token: `BOT_TOKEN`)**: Primary user-facing bot.
- **`ounce` (token: `OUNCE_PUBLISHER_BOT`)**: Feed and price publisher.
- **`PUBLISHER1_BOT`, `PUBLISHER2_BOT`**: Dynamic channels that forward trading signals.

---

## 4. Frontend Styling & Design Tokens

The Angular frontend follows a **Dark Premium Glassmorphism** design language.
- **Theme Colors**:
  - Primary Accent: Amber/Gold Gradient (`linear-gradient(135deg, #fbbf24 0%, #d97706 100%)`) with a solid accent of `#fbbf24`.
  - Background: Rich deep black (`#0a0a0a`).
  - Cards: Semi-transparent glass containers (`rgba(255, 255, 255, 0.03)` with `backdrop-filter: blur(10px)`).
  - Borders: Thin boundary lines (`1px solid rgba(255, 255, 255, 0.1)`).
- **Layout Patterns**:
  - External labels for `<mat-form-field>` (vertical above inputs, or horizontal alongside inputs with absolute error placement to prevent layout shifting).
  - Capsule-shaped segmented toggles and tab headers with no colored ink-bars.
  - Symmetrical transitions and active click scaling (`transform: scale(0.96)`) for a premium native app feel.

---

## 5. Development Scripts

Run the following commands in the root directory to build and test:

```bash
# Start backend in development mode (with hot-reload)
pnpm dev:backend

# Start frontend Angular dev server
pnpm dev:app

# Build backend for production
pnpm build:backend

# Build frontend for production
pnpm build:app
```
