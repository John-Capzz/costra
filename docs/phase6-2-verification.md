# Phase 6.2 — Arc Testnet verification

## Status

**Blocked by missing live configuration.** No live Arc Testnet transaction was
attempted and no live result is claimed.

The following values were checked by presence only; secret contents were not
printed or recorded:

- `ARC_TESTNET_RPC_URL` — missing
- `ARC_TESTNET_CHAIN_ID` — missing
- `ARC_TESTNET_EXECUTION_PRIVATE_KEY` — missing
- `ARC_TESTNET_SMOKE_DESTINATION` — missing
- `ARC_TESTNET_SMOKE_AMOUNT` — missing
- `DATABASE_URL` — missing in the current shell

## Required verification command

After injecting a dedicated Arc Testnet wallet, HTTPS RPC URL, destination, and
small test amount through a secret-managed staging environment, run:

```powershell
$env:RUN_ARC_TESTNET_SMOKE = 'true'
bun test tests/integration/arc-testnet-smoke.test.ts
```

The execution must use chain ID `5042002`, Arc Testnet USDC, a dedicated
testnet-only wallet, and an explicitly controlled destination. The resulting
transaction hash, receipt status, fee, and reconciliation must be recorded in
the staging runbook without recording the private key or other secrets.

## Current result

The opt-in smoke test remains skipped when the required variables are absent.
This is an intentional fail-safe and is distinct from a live verification.
