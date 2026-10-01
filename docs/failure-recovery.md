# COSTRA failure recovery and security boundary

This document describes the Phase 6.8 failure behavior for controlled Arc
Testnet execution. Blockchain submission and PostgreSQL persistence are
separate systems. COSTRA does not claim exactly-once blockchain execution.

## Recovery matrix

| Failure | Expected behavior | Persisted state | Retry/manual action |
| --- | --- | --- | --- |
| RPC unavailable before submission | Reject the request and release the reservation | Execution remains approved only if the release succeeds; no transaction row | Retry after RPC recovery; investigate if release itself fails |
| Invalid chain ID or invalid destination | Reject before submission | No transaction row; reservation is released | Correct configuration/input and retry |
| Insufficient native gas or USDC | Arc provider rejects submission; release the reservation when the outcome is known to be pre-submission | No successful transaction is recorded | Fund the controlled wallet, then retry with a new idempotency key |
| Budget exceeded | Reject before submission | No execution request is created and no spend is reserved | Increase the persisted budget through an authorized flow |
| Concurrent execution | PostgreSQL row locking permits only the budget-safe reservation | One reservation/execution may persist; the other is rejected | Retry the rejected request only after reviewing remaining budget |
| Duplicate idempotency request | Return the existing execution and transaction; never submit a second transfer | Existing execution/transaction is authoritative | Safe retry of the same request |
| Transaction submitted but transaction persistence fails | Do not automatically resubmit; report unavailable/manual recovery required | The execution may remain approved, or a transaction may exist without its execution update | Operator must recover the provider transaction and repair persistence; do not reuse the key to submit a second transfer |
| Receipt delayed | Preserve the submitted/pending state and return an unavailable/provider error | Execution remains submitted and transaction remains pending | Retry tracking later with the same transaction hash |
| Receipt indicates failure | Mark transaction failed and release the reservation atomically | Execution becomes failed; transaction remains as failed evidence | Investigate provider failure; a new attempt requires a new idempotency key |
| Reconciliation failure | Leave confirmed transaction data intact and allow reconciliation retry | Transaction remains confirmed; reconciliation is absent or failed | Retry reconciliation; manual intervention only if persistence remains unavailable |
| PostgreSQL unavailable | Fail closed with a structured unavailable error | No claim of a successful persistence operation | Restore database connectivity and retry/reconcile explicitly |
| Distributed rate-limit store unavailable | Reject the request rather than silently switching to an in-memory production limiter | No business operation is authorized by the limiter | Restore PostgreSQL and retry |
| Restart during pending execution | Do not infer success from an in-memory request; use persisted execution/transaction state and explicit receipt tracking | Submitted/pending records remain queryable | Track by the persisted transaction hash; unknown outcomes require operator recovery |

## Unknown blockchain outcomes

If a provider call may have broadcast a transaction but does not return a hash,
the result is unknown. COSTRA must not automatically submit again. The operator
should inspect Arc Testnet using the controlled execution address and available
provider evidence, then repair the corresponding persisted execution and
transaction records through an approved operational procedure. This recovery
procedure is intentionally manual until a durable reconciliation worker and
operator tooling exist.

If the transaction row was persisted but the execution row was not updated,
the next identical idempotency request can repair the execution link from the
transaction's task-scoped idempotency record. If no transaction row exists,
the request fails closed and does not resubmit.

## Security boundaries

- Arc Testnet is the only active chain.
- Guarded mode applies only to payments submitted through COSTRA's controlled
  execution path.
- External-wallet transactions cannot be blocked or recovered by COSTRA.
- Private keys, database credentials, API keys, and RPC credentials remain
  runtime secrets and are never persisted or returned by these recovery paths.
