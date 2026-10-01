import { createDatabasePool } from '../server/db/pool'
import { hashPassword } from '../server/auth/browser-session'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required and must be supplied through the environment.`)
  return value
}

async function main(): Promise<void> {
  const environment = process.env.COSTRA_ENV?.trim() || 'development'
  if (environment === 'production') {
    throw new Error('Demo-user provisioning is disabled in production.')
  }

  const email = required('DEMO_USER_EMAIL').toLowerCase()
  const password = required('DEMO_USER_PASSWORD')
  const name = process.env.DEMO_USER_NAME?.trim() || 'COSTRA Demo Operator'

  if (email.length > 320 || !email.includes('@')) throw new Error('DEMO_USER_EMAIL must be a valid bounded email.')
  if (password.length < 8 || password.length > 256) throw new Error('DEMO_USER_PASSWORD must be between 8 and 256 characters.')
  if (name.length > 200) throw new Error('DEMO_USER_NAME must be 200 characters or fewer.')

  const pool = createDatabasePool()
  try {
    const passwordHash = await hashPassword(password)
    const result = await pool.query<{ id: string }>(
      `INSERT INTO users (email, name, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name,
             password_hash = EXCLUDED.password_hash,
             updated_at = NOW()
       RETURNING id::text AS id`,
      [email, name, passwordHash],
    )
    const user = result.rows[0]
    if (!user) throw new Error('Demo-user provisioning did not return a user.')
    console.log(`Demo user provisioned: ${email} (${user.id})`)
  } finally {
    await pool.end()
  }
}

await main()
