# AGENTS.md — COSTRA

## Project
COSTRA: cost-planning and spending-control layer for autonomous agents.
Initial scaffold created with Arc Studio. Intended for continued engineering and hardening.

## Routes
- /dashboard — overview, spend chart, planned vs actual, recent tasks
- /plans — cost plan list
- /plans/new — create cost plan with cost engine estimation
- /plans/:id — plan detail with full cost breakdown
- /tasks — task list with status filter
- /tasks/:id — task detail with event timeline and reconciliation
- /agents — agent list
- /agents/:id — agent detail with radar chart, policies, tasks, activity
- /spending — spend charts, by-agent, by-service, event list
- /analytics — planned vs actual, accuracy trend, cost by type
- /developer — SDK and REST API reference with copyable code blocks
- /settings — theme, notifications, spending controls, default limits

## Architecture
- src/types/index.ts — all domain types
- src/lib/cost-engine.ts — modular cost estimation
- src/lib/budget-engine.ts — budget check, policy enforcement, reconciliation
- src/lib/arc-adapter.ts — ChainAdapter interface + ArcAdapter + ArcMainnetAdapter
- src/lib/demo-data.ts — realistic seed/demo data
- src/lib/utils.ts — formatting helpers
- server/ — REST API (Express, auth, rate limiting)
- sdk/ — @costra/sdk foundation
- db/schema.sql — PostgreSQL schema

## Deployed Contracts
None in V1. Smart contracts deferred to future COSTRA policy/escrow layer.

## Key Packages
react-router-dom, recharts, framer-motion, lucide-react, clsx, tailwind-merge
