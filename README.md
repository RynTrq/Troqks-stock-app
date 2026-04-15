# Troqks Stock App

Troqks is a Next.js market dashboard and quant research workspace for tracking broad market movement, exploring popular equities, generating strategies, running backtests, and managing paper-trading simulations. It combines TradingView embedded widgets, Yahoo Finance market data, API-backed authentication, MongoDB persistence, and a focused research UI.

Authentication uses MongoDB-backed user records, Node crypto password hashing, and signed HTTP-only session cookies.

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Setup](#setup)
- [Environment config](#environment-config)
- [Commands](#commands)
- [Testing and validation](#testing-and-validation)
- [Implementation notes](#implementation-notes)
- [Troubleshooting](#troubleshooting)
- [Production readiness](#production-readiness)

## Features

| Area | What it does |
| --- | --- |
| Dashboard | Displays a symbol-focused TradingView workspace with snapshot, technical analysis, charting, profile, and financials. |
| Search | Provides a working `/search` route for filtering popular symbols by ticker, company, or exchange. |
| Quant Lab | Provides prebuilt strategies, AI strategy generation, backtests, paper-trading sessions, persisted experiment history, and equity curves. |
| Authentication | Validates sign-in/sign-up forms, persists users in MongoDB, hashes passwords, and issues HTTP-only session cookies. |
| User menu | Reads the authenticated user from `/api/auth/me` and supports API-backed sign out. |
| UI system | Uses Tailwind CSS v4, Radix UI primitives, shadcn-style components, and shared utility classes. |
| Data layer | Uses a cached Mongoose connection helper and a typed user model. |
| Quality gates | Includes linting, production build validation, npm audit, and focused unit tests. |

## Tech Stack

| Layer | Tooling |
| --- | --- |
| Framework | Next.js 16 App Router |
| Runtime UI | React 19 |
| Styling | Tailwind CSS 4 |
| Forms | React Hook Form |
| Components | Radix UI, Base UI, lucide-react |
| Market widgets | TradingView external embedding scripts |
| Market data | Yahoo Finance chart endpoint |
| AI strategy generation | Groq OpenAI-compatible chat completions |
| Database helper | Mongoose / MongoDB |
| Tests | Vitest |
| Static analysis | ESLint 9 with Next core web vitals and TypeScript rules |

## Architecture

```mermaid
flowchart TD
    Browser["Browser"] --> RootLayout["app/layout.tsx"]
    RootLayout --> PublicShell["app/(root)/layout.tsx"]
    RootLayout --> AuthShell["app/(auth)/layout.tsx"]
    PublicShell --> Dashboard["app/(root)/page.tsx"]
    PublicShell --> Search["app/(root)/search/page.tsx"]
    PublicShell --> Quant["app/(root)/quant/page.tsx"]
    AuthShell --> SignIn["app/(auth)/sign-in/page.tsx"]
    AuthShell --> SignUp["app/(auth)/sign-up/page.tsx"]
    Dashboard --> TVComponent["components/TradingViewWidget.tsx"]
    TVComponent --> TVHook["hooks/usetradingviewwidget.tsx"]
    TVHook --> TradingView["TradingView embed scripts"]
    SignIn --> Validation["lib/validation.ts"]
    SignUp --> Validation
    Search --> Constants["lib/constants.ts"]
    UserMenu["components/UserDropdown.tsx"] --> MeRoute["/api/auth/me"]
    SignIn --> SignInAPI["/api/auth/sign-in"]
    SignUp --> SignUpAPI["/api/auth/sign-up"]
    SignInAPI --> MongoHelper["database/mongoose.ts"]
    SignUpAPI --> MongoHelper
    Quant --> QuantAPI["/api/quant/*"]
    QuantAPI --> MongoHelper
    QuantAPI --> Yahoo["Yahoo Finance data"]
    QuantAPI --> Groq["Groq API optional"]
    MongoHelper --> UserModel["database/models/User.ts"]
```

### Execution flow

1. `app/layout.tsx` loads global styles, fonts, metadata, and dark mode.
2. Public routes under `app/(root)` render the sticky header and dashboard/search content.
3. Auth routes under `app/(auth)` render onboarding forms and preview imagery.
4. Form submissions validate locally, post to `/api/auth/sign-in` or `/api/auth/sign-up`, and navigate to `/` on success.
5. Auth API routes validate input, connect to MongoDB, verify or create users, and set signed HTTP-only session cookies.
6. The header user dropdown reads the current user from `/api/auth/me`.
7. Quant routes require a signed-in user for writes and return only that user's persisted experiments.
8. TradingView widgets are mounted client-side by injecting the appropriate external script and JSON config.

## Project Structure

```text
app/
  (auth)/                 Auth-style layout, sign-in, and sign-up routes
  (root)/                 Dashboard shell, market dashboard, quant lab, and stock search route
  api/auth/               Authentication route handlers
  api/quant/              Strategy, backtest, market-history, and paper-trading route handlers
  globals.css             Tailwind imports, theme tokens, and shared app utilities
components/
  forms/                  Reusable React Hook Form fields
  ui/                     shadcn-style UI primitives
  Header.tsx              Public shell header
  TradingViewWidget.tsx   TradingView widget wrapper
  UserDropdown.tsx        Authenticated profile menu
  quant/                  Quant lab widgets and equity curve chart
database/
  mongoose.ts             Cached server-only MongoDB connection helper
  models/User.ts          User schema for auth and preferences
  models/*.ts             Quant experiment, backtest, and paper session schemas
hooks/
  usetradingviewwidget.tsx TradingView script lifecycle hook
lib/
  api.ts                  Route handler response helpers
  config.ts               Runtime configuration checks
  constants.ts            Navigation, form options, stock lists, widget config
  password.ts             Password hashing and verification
  session.ts              Signed session token helpers
  quant/                  Strategy engine, indicators, market data, AI compiler, and validation
  utils.ts                Class name merge utility
  validation.ts           Shared validation and normalization helpers
types/
  global.d.ts             Shared project type declarations
```

## Setup

### Prerequisites

| Requirement | Version |
| --- | --- |
| Node.js | 20 or newer recommended |
| npm | 10 or newer recommended |
| MongoDB | Required for sign-up and sign-in |

### Install

```bash
npm ci
```

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
npm run build
npm run start
```

## Environment Config

Copy `.env.example` to `.env.local` and fill in real values:

```bash
cp .env.example .env.local
```

```bash
MONGODB_URI=mongodb+srv://USER:PASSWORD@HOST/DATABASE
AUTH_SECRET=replace-with-at-least-32-random-characters
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
```

| Variable | Required now | Used by | Notes |
| --- | --- | --- | --- |
| `MONGODB_URI` | Yes for auth | `database/mongoose.ts`, `/api/auth/*` | Required for sign-up and sign-in. Never commit real credentials. |
| `AUTH_SECRET` | Yes in production | `lib/session.ts` | Used to sign HTTP-only session cookies. Must be at least 32 characters. Development has a fallback for local smoke tests. |
| `GROQ_API_KEY` | Optional | `/api/quant/strategy-generator` | Required only for AI strategy generation. Prebuilt strategies, backtests, and paper trading work without it. |
| `GROQ_MODEL` | Optional | `/api/quant/strategy-generator` | Defaults to `llama-3.3-70b-versatile`. |

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Build and type-check the production app. |
| `npm run start` | Serve the production build. |
| `npm run lint` | Run ESLint over the repository. |
| `npm run test` | Run Vitest unit tests. |
| `npm run check` | Run lint, tests, and production build in sequence. |
| `npm audit --audit-level=moderate` | Verify dependency advisories at moderate severity or higher. |

## Testing And Validation

The test suite covers shared validation, configuration checks, password hashing, session signing, and quant engine behavior:

```bash
npm run test
```

Use the full quality gate before shipping:

```bash
npm run check
npm audit --audit-level=moderate
```

## Implementation Notes

### TradingView widgets

Widget configuration lives in `lib/constants.ts`. `TradingViewWidget` delegates script mounting to `useTradingViewWidget`, which:

- Clears stale widget DOM before rendering a new config.
- Uses `textContent` for JSON config injection.
- Cleans up the exact mounted container on unmount.
- Replaces blocked widget frames with a clear load-failure message.

### Authentication

The auth screens use server-backed API routes:

- Sign-up validates full name, email, password, country, investment goal, risk tolerance, and industry.
- Sign-in validates email and password.
- Passwords are hashed with Node's `scrypt` implementation before storage.
- Successful sign-in/sign-up sets a signed HTTP-only cookie.
- Sign out expires the session cookie and returns to `/sign-in`.

Auth routes return clear configuration errors when `MONGODB_URI` or production `AUTH_SECRET` are missing.

### Quant Lab

The quant workspace lives at `/quant`:

- Prebuilt strategies are always available from the local strategy catalog.
- The AI strategy builder can either modify the currently selected strategy or switch to New Strategy mode to create one from scratch.
- AI-created or AI-edited strategies require `GROQ_API_KEY` and are validated into the same internal strategy AST as prebuilt templates.
- Backtests fetch daily OHLCV data from Yahoo Finance, run through the local engine, and persist results to MongoDB.
- Paper-trading sessions persist snapshots, trades, equity curves, and status changes for the signed-in user.
- Unauthenticated users can browse prebuilt strategies, but saved history and write actions require sign-in.

### MongoDB helper

`connectToDatabase` caches the Mongoose connection across server invocations and avoids logging connection strings. It throws clearly if `MONGODB_URI` is missing.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| TradingView panels stay blank | Confirm the browser can reach `https://s3.tradingview.com` and that content blockers are not blocking third-party scripts. |
| Build cannot find environment variables | Add `.env.local` and restart the dev server. |
| Sign-in returns `Authentication is not configured` | Set `MONGODB_URI`; set `AUTH_SECRET` too for production-like sessions. |
| Form accepts no submission | Check field-level validation messages. Passwords must be at least 8 characters. |
| Search route returns no results | Try a supported popular ticker such as `AAPL`, `MSFT`, `NVDA`, or an exchange such as `NASDAQ`. |
| AI strategy generation returns a config error | Set `GROQ_API_KEY`, or use the prebuilt strategy catalog without AI generation. |
| Backtest or paper trading says to sign in | Create an account or sign in first; quant write actions are user-scoped. |
| Browser reports a hydration warning on `<body>` attributes | Browser extensions can inject attributes before React hydrates. The root layout suppresses known extension-only attribute diffs. |

## Production Readiness

Already strengthened:

- Direct Next.js security advisories resolved by upgrading to Next.js 16.2.3.
- Broken `/search` navigation repaired with a real route.
- Form validation centralized and tested.
- Auth routes now persist MongoDB users, hash passwords, and issue signed HTTP-only session cookies.
- Quant routes are scoped to the authenticated user and no longer leak unauthenticated history or sessions.
- AI strategy editing preserves the selected strategy context, while New Strategy mode intentionally clears selection before creation.
- Sensitive MongoDB URI logging removed.
- TradingView script lifecycle hardened.
- Lint, build, test, and audit workflows documented.

Optional extensions:

- Persist saved stock lists and personalized dashboard preferences.
- Add end-to-end browser tests against a disposable MongoDB database.
- Add production monitoring around third-party TradingView script failures.
