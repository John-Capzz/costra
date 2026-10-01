# Demo-user provisioning

The browser dashboard authenticates against the PostgreSQL `users` table. A
demo or staging operator can provision one user with the repository's scrypt
password format using:

```powershell
$env:COSTRA_ENV = 'staging'
$env:DATABASE_URL = 'postgresql://...'
$env:DEMO_USER_EMAIL = 'demo@example.test'
$env:DEMO_USER_PASSWORD = (Read-Host 'Demo password' -AsSecureString | ConvertFrom-SecureString -AsPlainText)
$env:DEMO_USER_NAME = 'COSTRA Demo Operator'
bun run db:seed-demo-user
```

The command requires `DEMO_USER_EMAIL` and `DEMO_USER_PASSWORD`, updates an
existing matching email idempotently, and prints only the email and generated
user ID. It never prints or stores the plaintext password. It refuses to run
when `COSTRA_ENV=production`; production account provisioning must use a
separately controlled operator process.

Clear the environment variables after use. Do not put them in `.env`, a
`VITE_*` variable, source code, CI logs, or committed files.
