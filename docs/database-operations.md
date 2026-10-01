# COSTRA database operations

This runbook covers the database operations currently supported by COSTRA's
SQL migration boundary. It is intended for local development and staging
operators.

## Migrations

Migrations are ordered files in `db/migrations/`. The runner applies each
pending migration in its own transaction and records successful versions in
`schema_migrations`. A failed migration is rolled back and is not recorded as
applied. The runner must be run by one deployment operation at a time; do not
run competing migration commands against the same database.

Fresh database:

```text
bun run db:migrate
```

Existing database created before migration management:

```text
bun run db:migrate -- --baseline-existing
```

The baseline flag verifies the expected existing tables and authentication
columns before recording `0001_baseline`. It must not be used on a fresh
database.

To verify an upgrade path locally, run the migration command once and then run
it again. The second run should report no newly applied migrations. CI performs
this fresh-then-idempotent sequence against PostgreSQL 16 and runs the
migration failure tests.

There are no down migrations. A migration that has already been applied must
not be edited in place. Use a new forward migration to correct a deployed
schema. Before applying a destructive or data-transforming migration, take a
database backup and test the recovery plan.

## Backup

Backups are operator-managed. COSTRA does not currently create, upload, retain,
or verify backups automatically.

Example custom-format backup:

```text
pg_dump --format=custom --file=costra-YYYYMMDD-HHMM.dump "$DATABASE_URL"
```

Store the dump outside the repository with access controls appropriate for the
data. Never put `DATABASE_URL` or a dump containing production data in source
control.

## Restore and recovery

Restore into a new, isolated database first and verify the application against
it before changing the active database:

```text
createdb costra_restore_check
pg_restore --clean --if-exists --dbname="$COSTRA_RESTORE_DATABASE_URL" costra-YYYYMMDD-HHMM.dump
bun run db:migrate
```

The restore command above is a procedure, not an automated or currently
verified production recovery job. Confirm the restored `schema_migrations`
state and run the application health/readiness checks before cutover.

For a failed migration, keep the database in place, inspect the failed SQL and
server logs without exposing credentials, and correct the problem with a new
forward migration or an operator-approved recovery action. Do not delete
`schema_migrations` rows or manually mark an unsuccessful migration as applied.

## CI coverage

The CI workflow verifies:

- all frontend, backend, and SDK typechecks;
- application-source linting;
- a fresh PostgreSQL migration run;
- a second idempotent migration run;
- unit and PostgreSQL integration tests, including migration rollback behavior;
- `git diff --check`.

Automated backups, restores, production deployment, and rollback cutover are
not claimed by CI.
