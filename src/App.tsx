// ============================================================
// COSTRA — App root (client-side routing)
// ============================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Sidebar, MobileNav } from '@/components/layout/Navigation'
import { useTheme } from '@/hooks/useTheme'
import { useAuth } from '@/lib/auth'
import Login from '@/pages/Login'

// Pages
import Dashboard   from '@/pages/Dashboard'
import Plans       from '@/pages/Plans'
import PlanNew     from '@/pages/PlanNew'
import PlanDetail  from '@/pages/PlanDetail'
import Tasks       from '@/pages/Tasks'
import TaskDetail  from '@/pages/TaskDetail'
import Agents      from '@/pages/Agents'
import AgentDetail from '@/pages/AgentDetail'
import Spending    from '@/pages/Spending'
import Analytics   from '@/pages/Analytics'
import Developer   from '@/pages/Developer'
import Settings    from '@/pages/Settings'
import PublicTask  from '@/pages/PublicTask'

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav />
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-[var(--surface-strong)] focus:px-3 focus:py-2 focus:text-sm focus:text-[var(--ink)]">
          Skip to main content
        </a>
        <main id="main-content" className="flex-1" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  // Initialise theme on mount
  useTheme()
  const { user, loading } = useAuth()

  // Google Fonts — Space Grotesk + DM Sans + JetBrains Mono
  useEffect(() => {
    const id = 'costra-fonts'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id   = id
    link.rel  = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap'
    document.head.appendChild(link)
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/demo" element={<PublicTask />} />
        <Route path="*" element={loading ? <div className="min-h-screen" style={{ background: 'var(--bg)' }} /> : user ? <AppShell><Routes>
          <Route path="/"               element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"      element={<Dashboard />} />
          <Route path="/plans"          element={<Plans />} />
          <Route path="/plans/new"      element={<PlanNew />} />
          <Route path="/plans/:id"      element={<PlanDetail />} />
          <Route path="/tasks"          element={<Tasks />} />
          <Route path="/tasks/:id"      element={<TaskDetail />} />
          <Route path="/agents"         element={<Agents />} />
          <Route path="/agents/:id"     element={<AgentDetail />} />
          <Route path="/spending"       element={<Spending />} />
          <Route path="/analytics"      element={<Analytics />} />
          <Route path="/developer"      element={<Developer />} />
          <Route path="/settings"       element={<Settings />} />
          <Route path="*"               element={<Navigate to="/dashboard" replace />} />
        </Routes></AppShell> : <Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
