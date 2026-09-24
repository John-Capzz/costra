# COSTRA — Roadmap

## V1 (Current — Foundation)

- [x] Cost engine with modular cost items
- [x] Budget engine (check, derive state, policies)
- [x] Arc chain adapter (ChainAdapter interface)
- [x] REST API (plans, tasks, events, reconcile, budget check)
- [x] @costra/sdk (plan → track → reconcile)
- [x] PostgreSQL schema
- [x] Dashboard, Cost Plans, Tasks, Agents, Spending, Analytics
- [x] Planned vs Actual reconciliation view
- [x] Light/dark theme
- [x] Responsive design (desktop + mobile)

## V1.1 — Database & Persistence

- [ ] PostgreSQL connection (Drizzle ORM or raw pg)
- [ ] Migrations (db-migrate or Drizzle migrate)
- [ ] Replace in-memory task store with DB
- [ ] API key management UI (create, revoke, rotate)
- [ ] User authentication (JWT + session)

## V1.2 — Live Agent Integration

- [ ] WebSocket push for live task updates
- [ ] SDK polling: `costra.track(taskId).onEvent(callback)`
- [ ] Budget alert webhooks (approaching/blocked)
- [ ] OpenAI / Anthropic cost reporting helpers

## V2 — Prediction & Learning

- [ ] Historical cost data from reconciliation table
- [ ] Per-agent per-task-type cost averages
- [ ] Confidence interval display on cost plans
- [ ] Provider comparison (e.g. OpenAI vs Anthropic inference cost)
- [ ] Cost simulation (what-if analysis)

## V2.1 — Wallet Integration

- [ ] Circle developer-controlled wallets integration
- [ ] USDC balance tracking per agent
- [ ] Guarded mode enforcement via Circle wallet spending policies
- [ ] Transaction confirmation tracking via Arc RPC

## V3 — Policy Contract

- [ ] COSTRA escrow contract (Solidity, Arc)
- [ ] On-chain budget enforcement via smart contract
- [ ] USDC pre-authorisation per task
- [ ] On-chain reconciliation events

## V3+ — Ecosystem

- [ ] Agent Marketplace listing (Circle x402)
- [ ] Multi-chain support (Ethereum, Base, Arbitrum)
- [ ] COSTRA Analytics API (aggregate cost data)
- [ ] COSTRA Audit Export (CSV, PDF)
- [ ] Provider SDK plugins (@costra/openai, @costra/anthropic)
