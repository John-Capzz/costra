// ============================================================
// COSTRA — REST API Server
// Express + TypeScript backend
// ============================================================

import { createApp } from './app'
import { readRuntimeConfig } from './runtime-config'

const runtime = readRuntimeConfig()

const app = createApp()

app.listen(runtime.port, () => {
  console.log(`[COSTRA API] environment=${runtime.environment} listening on port ${runtime.port}`)
})

export default app
