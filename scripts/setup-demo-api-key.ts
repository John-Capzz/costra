import { createDatabasePool } from '../server/db/pool'
import { createApiKeyInput, PostgresApiKeyManagementStore } from '../server/auth/api-key-management'

const DEMO_USER_ID = '295bca72-2658-4c8f-b4dc-6508447a1f58'

async function main(): Promise<void> {
  const pool = createDatabasePool()
  try {
    const user = await pool.query<{ id: string }>(
      'SELECT id::text AS id FROM users WHERE id = $1 LIMIT 1',
      [DEMO_USER_ID],
    )
    if (!user.rows[0]) throw new Error(`Demo user ${DEMO_USER_ID} was not found.`)

    const { secret, input } = createApiKeyInput('COSTRA demo agent')
    const record = await new PostgresApiKeyManagementStore(pool).createForUser(DEMO_USER_ID, input)
    console.log(`Demo API key created: ${record.id}`)
    console.log(`COSTRA_API_KEY=${secret}`)
  } finally {
    await pool.end()
  }
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Demo API-key setup failed.')
  process.exitCode = 1
}
