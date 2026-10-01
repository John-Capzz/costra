# COSTRA database migrations

Migrations are ordered SQL files applied by the `db:migrate` script. The
migration runner records successful versions in `schema_migrations` and runs
each migration in its own transaction.

## Fresh database

Configure `DATABASE_URL` or the `PG*` variables, then run:

```text
bun run db:migrate
```

## Existing Phase 1 database

The original `db/schema.sql` was applied manually before migration management
was introduced. For that database, explicitly establish the baseline first:

```text
bun run db:migrate -- --baseline-existing
```

The command verifies the existing Phase 1/domain tables and required auth
columns before recording `0001_baseline` as applied. It does not recreate,
drop, or rewrite those tables. It then applies later migrations normally.

Do not use `--baseline-existing` against a fresh database; it is intentionally
an explicit operator action.
