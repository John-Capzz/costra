import { createDatabasePool } from '../server/db/pool'
import {
  baselineExistingDatabase,
  runMigrations,
} from '../server/db/migrations'

const baselineExisting = process.argv.includes('--baseline-existing')
const pool = createDatabasePool()

try {
  if (baselineExisting) {
    await baselineExistingDatabase(pool)
  }

  const result = await runMigrations(pool)
  console.log(JSON.stringify(result))
} finally {
  await pool.end()
}
