# COSTRA — Security

COSTRA handles economic decisions for autonomous agents. Treat it as financial infrastructure.

## API Authentication

- Every API request requires `Authorization: Bearer <api_key>`
- API keys are stored as SHA-256 hashes — the plaintext is shown **once** at creation
- Key rotation invalidates the previous hash
- Keys are scoped to a user/organisation

## Input Validation

- All request bodies validated before processing
- Monetary values parsed as `parseFloat` and stored as `NUMERIC(18,6)` — no floating point in the DB
- Task descriptions and agent names sanitised (no HTML injection in API responses)
- `task` fields have a max length enforced server-side

## Replay Protection

- `idempotency_key` columns on `tasks` and `execution_events`
- Duplicate submissions with the same key return the original response (HTTP 200) without re-processing
- Prevents double-charging from network retries

## Rate Limiting

- In-memory sliding window: 120 req/min per IP (current)
- Production: Redis-backed with per-API-key limits

## Secrets

- No secrets in frontend code (`src/`)
- No private keys anywhere in the codebase
- Environment variables via `.env` (never committed)
- API key hashing prevents exposure if the DB is compromised

## Budget Enforcement

- `checkBudget()` is called in the API before recording a spend event in Guarded mode
- The budget check is atomic with the event recording (single transaction in production)
- `SPEND_BLOCKED` events are logged immutably even when a spend is rejected

## Audit Trail

- Every spend event is recorded with a timestamp, type, provider, cost, and optional tx hash
- Events are append-only — no delete or update on `execution_events`
- Reconciliations record the complete planned vs actual breakdown

## On-chain

- No private keys stored or handled by COSTRA backend
- Blockchain reads use public RPC endpoints
- Transaction hashes are recorded for auditability, not used for signing

## What COSTRA Cannot Do

- COSTRA **cannot** stop arbitrary transactions from an external wallet
- COSTRA **cannot** guarantee enforcement if the agent bypasses the SDK/API
- Guarded mode only enforces limits when the payment path passes through COSTRA-controlled code
- COSTRA does **not** custody funds

## Future Hardening

- Rate limiting per API key (not just per IP)
- JWT-based session tokens for dashboard authentication
- Webhook signature verification (HMAC-SHA256)
- Field-level encryption for sensitive metadata
- SOC 2 Type II audit preparation
