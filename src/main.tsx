// ============================================================
// COSTRA — Entry point
// ============================================================

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { AuthProvider } from './lib/auth'

// Import console & tracing capture (Arc Studio sandbox)
import './console-capture'
import './tracing'

const root = document.getElementById('root')
if (!root) throw new Error('No #root element found')

createRoot(root).render(
  <StrictMode>
    <AuthProvider><App /></AuthProvider>
  </StrictMode>,
)
