# COSTRA staging

Staging runs the existing Node/Express API, Vite frontend, PostgreSQL database,
and Arc Testnet controlled execution boundary. It does not enable Arc Mainnet,
additional chains, arbitrary-wallet control, or external-wallet blocking.

## Environment modes

Set `COSTRA_ENV` explicitly to one of `development`, `test`, `staging`, or
`production`. Development and test preserve the local/test behavior of the
repository. Staging and production fail during server startup unless their
required configuration is present and valid.

## Required staging configuration

Copy `.env.staging.example` into the staging secret/configuration system and
populate it there. Never commit a populated environment file.

Required backend values:

- `COSTRA_ENV=staging`
- `DATABASE_URL` or the complete `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD` set
- `CORS_ORIGIN` set to the exact staging frontend origin; wildcard CORS is rejected
- `ARC_TESTNET_RPC_URL` using HTTPS
- `ARC_TESTNET_CHAIN_ID=5042002`
- `ARC_TESTNET_EXECUTION_PRIVATE_KEY` containing a dedicated Arc Testnet key
- `ARC_TESTNET_EXECUTION_ADDRESS` matching the derived address for that key

`VITE_COSTRA_API_BASE_URL` is safe frontend build configuration. API keys,
database credentials, RPC credentials, and private keys must never be placed in
`VITE_*` variables because Vite embeds them into the browser bundle. Browser
authentication hardening remains a later Phase 6 checkpoint.

## Startup and deployment procedure

1. Install the locked dependencies with `bun install`.
2. Apply ordered migrations with `bun run db:migrate` against the staging database.
3. Build the frontend with the staging `VITE_COSTRA_API_BASE_URL`.
4. Start the API with `COSTRA_ENV=staging bun run server`.
5. Verify `GET /health` returns status `ok`.
6. Verify `GET /ready` reports PostgreSQL ready.
7. Verify the API is reachable only from the configured CORS origin.
8. Run the non-live test suite before enabling any live Arc Testnet execution.

Database backup, restore, migration recovery, and the distinction between
forward migrations and unsupported down migrations are documented in
[`docs/database-operations.md`](database-operations.md). Backups and restores
are operator procedures; they are not automated or claimed as production
verified by the application.

The server startup log prints only the environment, port, and health-safe
operational information. It must never print connection strings, API keys,
private keys, or authorization headers.

Staging rate limiting uses the PostgreSQL-backed distributed bucket table. No
Redis dependency is introduced for the current staging architecture. Receipt
tracking remains an explicit authenticated API operation; staging does not yet
claim autonomous background receipt monitoring or exactly-once blockchain
execution.

Operational signals are currently emitted as structured JSON logs and retained
in an in-process metrics registry exposed to the server runtime. An external
metrics exporter, dashboard, and alert sink remain deployment work; the app
does not claim durable metrics across restarts yet.

## Current staging boundary

Arc Testnet controlled execution is configuration-gated and distinct from the
simulation-only planning/balance behavior. Observe mode remains observational.
Guarded mode can enforce a budget only when the payment is submitted through
COSTRA's controlled execution path; it cannot block a transaction sent directly
from an external wallet.

The execution private key is runtime-only configuration. It is not stored in
PostgreSQL, returned by the API, sent to the frontend, or written to logs. The
current staging boundary uses secret-managed environment injection; migration
to a dedicated secret manager is recommended before production custody.
