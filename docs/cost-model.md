# COSTRA cost model foundation

Phase 3 uses USDC as its V1 currency. Authoritative monetary values use six decimal places (micro-USDC) and are represented by the fixed-scale `Money` domain primitive rather than JavaScript floating-point numbers.

The money rules are:

- Inputs are decimal strings without exponent notation.
- Negative monetary inputs are rejected by default.
- `NaN`, `Infinity`, malformed values, and values over six decimal places are rejected.
- Addition and subtraction operate on integer micro-USDC units.
- Multiplication defaults to rejecting results that exceed six decimal places. `half-up` rounding must be explicitly requested.
- Zero is represented as `0.000000`.
- PostgreSQL `NUMERIC` remains authoritative at persistence boundaries.

Cost items retain the existing categories and schema precision: unit rates support up to eight decimal places, quantities up to four, and calculated USDC estimates up to six. Item amounts are calculated as quantity × unit rate, with explicit half-up rounding at the final six-decimal USDC amount. Item currency is inherited from the parent plan and is currently restricted to USDC.

The existing UI-facing numeric types and heuristic estimator remain unchanged in Checkpoint 3.1. The exact estimator and planning layer are now connected to PostgreSQL through a transactional persistence service; API integration remains a later Phase 3 checkpoint.

Budget planning now represents estimated cost, safety margin, recommended budget, maximum budget, and remaining headroom as separate exact values. Safety margins may be fixed USDC amounts or percentages. A recommended budget above the maximum budget is rejected. Resolved `per_task` and `agent` policy limits are evaluated by the pure planning layer; loading those policies from PostgreSQL remains a later persistence-integration step.
