import { Outlet } from 'react-router-dom'
import { Sidebar } from './Navigation'
import { MobileNav } from './Navigation'

export function AppShell() {
  return (
    <div className="flex min-h-dvh bg-[var(--bg)]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
