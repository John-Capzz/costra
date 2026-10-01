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
- `ArcAdapter` provides simulation for planning plus an explicitly configured Arc Testnet execution boundary
- Arc Testnet is the only active supported network; no mainnet or multi-chain adapter is registered
- Controlled transaction submission and receipt tracking are available only with explicit testnet configuration; live USDC balance reads remain deferred
- All blockchain values in USDC (Arc's native gas token)

## Spending Modes

| Mode | Behaviour |
|------|-----------|
| **Observe** | COSTRA tracks all spend events but does not block execution. Suitable for external/uncontrolled wallets. |
| **Guarded** | Enforced only for the narrow COSTRA-controlled Arc Testnet execution path, including atomic reservation and idempotency. It does not enforce arbitrary external-wallet spending. |

Guarded mode requires the payment path to pass through COSTRA-controlled logic. The current implementation provides that narrow Arc Testnet path; COSTRA cannot stop arbitrary transactions from an external wallet.

## API Design

- REST over HTTPS
- `Authorization: Bearer <api_key>` — key hashed (SHA-256) at rest
- Idempotency keys on task creation and event appending
- Rate limiting: 120 req/min per IP plus authenticated principal, backed by PostgreSQL in staging/production and memory only in development/test
- Operational logs are structured JSON with request ID, principal ID where available, operation, resource ID, status, and duration; secrets and authorization headers are redacted
- `/health` is a liveness check; `/ready` checks PostgreSQL in staging/production
- Consistent error envelope: `{ error: { code, message, requestId } }`; internal details are logged server-side and are not returned to clients

## Database

PostgreSQL 15+ with pgcrypto and uuid-ossp extensions.

Schema changes are managed through ordered SQL migrations under
`db/migrations/`. The migration runner records applied versions in
`schema_migrations`, runs each migration transactionally, and requires an
explicit baseline operation for databases initialized from the original
`db/schema.sql`.

Focused repositories expose ownership-scoped reads and writes. Persisted ownership resolves through
`users -> agents -> plans/tasks` and through the task relationship for events,
transactions, execution requests, and reconciliations. Execution routes use the
same authenticated ownership boundary.

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
