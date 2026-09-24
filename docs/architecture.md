# COSTRA — Architecture

## Overview

COSTRA is a full-stack TypeScript application structured as a monorepo with four logical packages:

```
frontend   (src/)        Vite + React + TypeScript
backend    (server/)     Express REST API
sdk        (sdk/)        @costra/sdk programmatic client
shared     (src/types/)  Domain types + core engines
```

## Domain Model

```
User
  └── Agent (many)
        ├── BudgetPolicy (many)
        ├── CostPlan (many)
        │     └── CostItem (many)
        └── Task (many)
              ├── ExecutionEvent (many)
              ├── Transaction (many)
              └── Reconciliation (one)
```

## Core Engines

### Cost Engine (`src/lib/cost-engine.ts`)
- Input: agent, task description, network, max budget
- Output: `CostEstimationResult` — line items, confidence, recommended budget
- Pluggable provider catalogue: each cost type maps to a provider with a unit price
- Future: historical data from the reconciliations table improves estimates over time

### Budget Engine (`src/lib/budget-engine.ts`)
- `deriveBudgetState(current, limit)` → `within | approaching | blocked | completed`
- `checkBudget(current, limit, proposedSpend)` → `BudgetCheckResult`
- `checkPolicies(proposedSpend, policies, context)` — checks all policy types in order
- `computeVariance(estimated, actual)` → variance + variance percent

### Arc Adapter (`src/lib/arc-adapter.ts`)
- `ChainAdapter` interface: `estimateTransactionCost`, `getTransaction`, `getBalance`, `trackTransaction`
- `ArcAdapter` implements the interface for Arc Testnet
- `registerAdapter(key, adapter)` — extend without modifying core
- All blockchain values in USDC (Arc's native gas token)

## Spending Modes

| Mode | Behaviour |
|------|-----------|
| **Observe** | COSTRA tracks all spend events but does not block execution. Suitable for external/uncontrolled wallets. |
| **Guarded** | Every spend request passes through a `checkBudget` call. If it fails, the event is logged as `SPEND_BLOCKED` and execution is halted. |

Guarded mode requires the payment path to pass through COSTRA-controlled logic. COSTRA cannot stop arbitrary transactions from an external wallet.

## API Design

- REST over HTTPS
- `Authorization: Bearer <api_key>` — key hashed (SHA-256) at rest
- Idempotency keys on task creation and event appending
- Rate limiting: 120 req/min per IP (in-memory; Redis in production)
- Consistent error envelope: `{ error: string, message: string }`

## Database

PostgreSQL 15+ with pgcrypto and uuid-ossp extensions.

Key decisions:
- `api_keys.key_hash` — SHA-256, never plaintext
- `execution_events.idempotency_key` — unique constraint, prevents duplicate spend reporting
- `tasks.idempotency_key` — prevents duplicate task creation
- All monetary amounts stored as `NUMERIC(18, 6)` — no floating point
- `TIMESTAMPTZ` everywhere — timezone-safe

## Frontend Architecture

- Client-side routing via `react-router-dom`
- Design tokens via CSS custom properties (`var(--...)`)
- Light/dark theme — stored in `localStorage`, applied to `document.documentElement`
- All monetary formatting through `formatUsd()` — never ad-hoc
- Demo data in `src/lib/demo-data.ts` — clearly separated from live data paths
- Charts: Recharts (AreaChart, BarChart, RadarChart)
- Animations: Framer Motion (navigation, plan results)

## Security Architecture

See `docs/security.md`.
