# Phase 2 verification setup

The Phase 2 verification environment uses PostgreSQL 16 and the existing Bun/TypeScript scripts.

## Local PostgreSQL

Start a disposable PostgreSQL 16 container:

```powershell
docker run --name costra-pg-verify `
  -e POSTGRES_USER=costra_verify `
  -e POSTGRES_PASSWORD=costra_verify_password `
  -e POSTGRES_DB=costra_verify `
  -p 55432:5432 `
  -d postgres:16
```

Set the connection for the current PowerShell session:

```powershell
$env:DATABASE_URL = "postgresql://costra_verify:costra_verify_password@localhost:55432/costra_verify"
$env:PGSSL = "false"
```

Run a fresh migration chain:

```powershell
bun run db:migrate
```

For an existing database that already contains the baseline schema, use the baseline path once:

```powershell
bun run db:migrate -- --baseline-existing
```

Do not use `--baseline-existing` on an empty database.

## Integration tests

The real PostgreSQL integration suite is separate from the unit/contract suite:

```powershell
bun test tests/integration/phase2-postgres.test.ts
```

It requires `DATABASE_URL`, creates unique records, and removes them during teardown.

## Server and health check

Start the server:

```powershell
bun run server
```

Verify:

```powershell
Invoke-RestMethod http://localhost:3001/health
```

Expected response:

```json
{"status":"ok","version":"1.0.0"}
```

## Windows Node/tsx workaround

On the verified Windows environment, Node.js 26.1.0 can cause `tsx` to fail before application startup with:

```text
uv_os_get_passwd returned ENOMEM
```

The failure originates in `tsx` calling `os.userInfo()` while creating its temporary directory. The application does not need a source-code workaround. Until Node.js 22 LTS is installed and verified, run the process with the narrow compatibility shim:

```powershell
$env:NODE_OPTIONS = "--require=$PWD/scripts/windows-node26-os-userinfo.cjs"
bun run db:migrate
bun test tests/integration/phase2-postgres.test.ts
bun run server
```

The shim only supplies a fallback username when the operating-system call fails. Node.js 22 LTS remains the preferred supported Windows runtime, but it was not available in the verification environment.
