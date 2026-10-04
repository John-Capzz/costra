# COSTRA — Security

COSTRA handles economic decisions for autonomous agents. Treat it as financial infrastructure.

## API Authentication

- Every API request requires `Authorization: Bearer <api_key>`
- API keys are stored as SHA-256 hashes — the plaintext is shown **once** at creation
- Revocation invalidates a key at the authentication boundary
- Authenticated API-key creation, listing, revocation, and atomic rotation are available through the API
- Plaintext keys are returned only on create/rotate and are never stored or returned again
- Keys are associated with a user; organisation-level tenancy is deferred

## Browser Authentication

- The browser uses a PostgreSQL-backed opaque session in an HttpOnly cookie; API keys are never embedded in frontend bundles or environment variables.
- Passwords are verified with Node's scrypt implementation and only the derived password verifier is stored.
- Sessions expire after eight hours and logout revokes the server-side session.
- State-changing browser requests require a session-bound CSRF token sent in the `X-CSRF-Token` header. The token is generated at login, stored with the server-side browser session, returned in the login response, and kept only in frontend memory. API-key requests are not subject to browser-session CSRF checks.
- Staging and production use Secure, SameSite=Lax cookies and an explicit credentialed CORS origin; wildcard credentialed CORS is rejected.

## Input Validation

- All request bodies validated before processing
- Monetary values are validated as bounded decimal strings and stored as `NUMERIC(18,6)`; authoritative financial arithmetic uses exact decimal semantics
- Task descriptions and agent names sanitised (no HTML injection in API responses)
- `task` fields have a max length enforced server-side

## Replay Protection Status

- `idempotency_key` columns exist in the schema for future task/event persistence
- Route-level duplicate prevention is not implemented while those resources remain in-memory

## Persisted ownership boundary

- Repository access is scoped through the authenticated user's persisted agent relationships.
- Plans, tasks, events, transactions, and reconciliations resolve ownership through their persisted parent chain.
- A missing owner fails closed; a resource owned by another user is rejected.
- API-key management is ownership-scoped to the authenticated principal; hashes and secrets are never exposed.

## Rate Limiting

- Development/test: in-memory sliding window for local feedback
- Staging/production: PostgreSQL-backed distributed sliding window, with IP and authenticated-principal buckets
- If the staging/production rate-limit store is unavailable, requests fail with a structured `unavailable` response rather than bypassing the limit

## Secrets

- No secrets in frontend code (`src/`)
- No private keys anywhere in the codebase
- Environment variables via `.env` (never committed)
- API key hashing prevents exposure if the DB is compromised

## Budget Enforcement Status

- `checkBudget()` is available as a pure policy calculation and API check
- General spend-event reporting remains observational, while the controlled Arc Testnet execution path atomically reserves task headroom before submission
- Guarded mode cannot block arbitrary transactions from wallets outside COSTRA-controlled payment paths

## Audit Trail Status

- The schema models timestamped spend events, optional transaction hashes, and reconciliations
- Full append-only persisted audit behavior is deferred with domain persistence

## On-chain Capability Status

- Controlled Arc Testnet execution may use a dedicated testnet private key supplied through environment configuration; keys are never returned or logged
- The configured execution address is checked against the derived runtime signer identity before use
- The Arc Testnet chain ID and configured USDC contract are checked at the signing boundary
- Arc Testnet is the only active supported development network
- Arc transaction submission and receipt tracking are available only when explicitly configured; live balance reads remain deferred
- Transaction hashes are recorded and receipt-checked for controlled executions; observed event hashes are not proof of COSTRA submission

## What COSTRA Cannot Do

- COSTRA **cannot** stop arbitrary transactions from an external wallet
- COSTRA **cannot** guarantee enforcement if the agent bypasses the SDK/API
- Guarded mode only enforces limits when the payment path passes through COSTRA-controlled code
- COSTRA does **not** custody funds

## Future Hardening

- Rate limiting per API key (not just per IP)
- Password reset, account provisioning, and external identity providers remain deferred
- Webhook signature verification (HMAC-SHA256)
- Field-level encryption for sensitive metadata
- SOC 2 Type II audit preparation
