# COSTRA

**Cost-planning and spending-control infrastructure for autonomous agents.**

COSTRA helps autonomous agents estimate, budget, track, and reconcile the total economic cost of completing a task — before and during execution.

> This initial application scaffold was created using [Arc Studio](https://studio.arc.io) and is intended for continued engineering, security hardening, and production deployment. The core architecture, visual system, API foundation, and SDK are production-ready starting points, not a final product.

---

## The Problem

Autonomous agents can call paid APIs, run AI inference, send blockchain transactions, pay for external services, and retry failed operations — all within a single task. Before COSTRA, there was no standardised way to:

- **predict** total task cost before execution
- **enforce** spending limits across heterogeneous cost types
- **reconcile** actual vs estimated spending after the fact
- **audit** the complete economic history of a task

---

## Core Product Loop

```
PLAN → BUDGET → EXECUTE → TRACK → RECONCILE
```

1. **Plan** — generate a cost estimate broken down by inference, API calls, blockchain transactions, retries, and service fees
2. **Budget** — define spending limits at task, transaction, daily, and agent level
3. **Execute** — the agent runs; COSTRA tracks every spend event
4. **Track** — real-time budget state (within / approaching / blocked)
5. **Reconcile** — compare planned vs actual; build cost prediction history

---

## Architecture

```
costra/
├── src/                  Frontend (Vite + React + TypeScript)
│   ├── pages/            Route-level components
│   ├── components/       UI primitives and layout
│   ├── lib/              Core engines (cost, budget, arc adapter)
│   ├── hooks/            React hooks (useTheme)
│   └── types/            Shared TypeScript domain types
├── server/               REST API (Express + TypeScript)
│   ├── routes/           plans, tasks, agents, spending, budget
│   └── middleware/       auth, rateLimit, error
├── sdk/                  @costra/sdk — programmatic client
├── db/                   PostgreSQL schema + migrations
└── docs/                 Architecture, security, roadmap
```

See [`docs/architecture.md`](docs/architecture.md) for the full architecture diagram.

---

## Arc Integration

COSTRA is Arc-first. Arc is Circle's blockchain where **USDC is the native gas token**, giving extremely predictable transaction costs.

Key integration points:
- `ArcAdapter` in `src/lib/arc-adapter.ts` — chain adapter for transaction cost estimation, balance lookup, and transaction tracking
- Extend with `registerAdapter(key, adapter)` to add more chains without touching core logic
- Arc Testnet Chain ID: `5042002`; Mainnet: `5042`
- Gas is USDC — no ETH required for Arc transactions

---

## API

Base URL: `http://localhost:3001/api/v1`

Authentication: `Authorization: Bearer <api_key>`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/plans` | Create a cost plan |
| GET  | `/plans/:id` | Fetch a plan |
| POST | `/tasks` | Create a task |
| GET  | `/tasks/:id` | Fetch a task |
| POST | `/tasks/:id/events` | Append an execution event |
| POST | `/tasks/:id/reconcile` | Reconcile a completed task |
| GET  | `/agents` | List agents |
| GET  | `/spending` | Query spending history |
| POST | `/budget/check` | Check a spend against budget |

---

## SDK

```typescript
import { Costra } from '@costra/sdk'

const costra = new Costra({ apiKey: process.env.COSTRA_API_KEY })

// 1. Plan
const plan = await costra.plan({
  agent:     'research-agent',
  task:      'Research 10 DeFi protocols on Arc',
  network:   'arc-testnet',
  currency:  'USDC',
  maxBudget: '5.00',
})

// 2. Track
const tracker = costra.track(plan.taskId)
await tracker.event({ type: 'API_CALL', provider: 'DeFiLlama', cost: '0.08', description: 'TVL fetch' })

// 3. Budget check before a spend
const check = await tracker.budgetCheck({ proposedSpend: '0.50' })
if (!check.allowed) throw new Error(check.reason)

// 4. Reconcile
const reconciliation = await costra.reconcile(plan.taskId)
console.log(reconciliation.variancePct) // e.g. +11.32%
```

---

## Local Development

### Prerequisites
- Bun 1.x
- PostgreSQL 15+
- Node 20+ (for Circle CLI only)

### Setup

```bash
# Install dependencies
bun install

# Set up environment
cp .env.example .env
# Edit .env with your DB credentials

# Run DB migrations
psql $DATABASE_URL -f db/schema.sql

# Start frontend (port 5173)
bun run dev

# Start API server (port 3001)
bun run server
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `COSTRA_API_KEY` | Admin API key for local dev |
| `CORS_ORIGIN` | Allowed CORS origin (default: http://localhost:5173) |
| `PORT` | API server port (default: 3001) |

---

## Testing

```bash
# Unit tests
bun test

# Type check
bun run typecheck

# Lint
bun run lint
```

---

## Future Roadmap

See [`docs/roadmap.md`](docs/roadmap.md) for the full roadmap.

Key upcoming capabilities:
- PostgreSQL persistence replacing in-memory stores
- Agent wallet integration (Circle developer-controlled wallets)
- Historical cost prediction from reconciliation data
- Provider comparison and dynamic estimation
- COSTRA policy smart contract (escrow + enforcement)
- Multi-chain support (Ethereum, Base, Arbitrum)
- Webhook delivery for budget events
