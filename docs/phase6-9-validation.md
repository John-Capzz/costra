# Phase 6.9 staging validation

The staging journey is available as a gated PostgreSQL-backed integration
test. It uses the real Express app, API-key authentication, repositories,
cost/budget services, and database migrations. It intentionally does not
pretend to be a live Arc verification when Arc credentials are absent.

Run it with a staging database and an explicitly unreachable Arc endpoint to
verify fail-closed execution handling:

```text
RUN_STAGING_E2E=true \
DATABASE_URL=postgresql://... \
bun test tests/integration/phase6-9-staging.test.ts
```

The journey verifies:

- persisted API-key authentication;
- agent selection and ownership;
- exact cost-plan creation and inspection;
- budget approval;
- persisted task and event creation;
- reconciliation;
- spending query;
- cross-owner access rejection;
- controlled execution failure as a structured unavailable response.

Live Arc Testnet submission, confirmation, transaction tracking, and live
frontend-to-API browser execution remain credential-gated and deferred from
this verification run. The opt-in live smoke test remains the authoritative
path for those capabilities.
