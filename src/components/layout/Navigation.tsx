// ============================================================
// COSTRA — Navigation (sidebar + mobile nav)
// Custom-designed, not a generic SaaS template
// ============================================================

import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, FileText, Bot, ListChecks,
  CreditCard, BarChart2, Code2, Settings,
  Menu, X, ChevronRight,
} from 'lucide-react'
import { DolphinLogo } from '@/components/ui/DolphinLogo'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/dashboard',   label: 'Overview',    icon: LayoutDashboard },
  { to: '/plans',       label: 'Cost Plans',  icon: FileText },
  { to: '/agents',      label: 'Agents',      icon: Bot },
  { to: '/tasks',       label: 'Tasks',       icon: ListChecks },
  { to: '/spending',    label: 'Spending',    icon: CreditCard },
  { to: '/analytics',   label: 'Analytics',   icon: BarChart2 },
] as const

const NAV_BOTTOM = [
  { to: '/developer',   label: 'Developer',   icon: Code2 },
  { to: '/settings',    label: 'Settings',    icon: Settings },
] as const

// ---- Sidebar nav item -------------------------------------

function SidebarItem({
  to, label, Icon,
}: { to: string; label: string; Icon: React.ElementType }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 px-3 py-2.5 rounded-[8px] transition-all duration-150',
          'text-[13px] font-medium',
          isActive
            ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-ink)]'
            : 'text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-ink)]',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Active indicator strip */}
          {isActive && (
            <motion.span
              layoutId="sidebar-active-strip"
              className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-[var(--sidebar-accent)]"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
          <Icon
            size={15}
            strokeWidth={isActive ? 2 : 1.75}
            className={cn(
              'transition-colors flex-shrink-0',
              isActive ? 'text-[var(--sidebar-accent)]' : 'text-[var(--sidebar-muted)] group-hover:text-[var(--sidebar-ink)]',
            )}
          />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )
}

// ---- Sidebar ----------------------------------------------

export function Sidebar() {
  return (
    <nav
      className="hidden lg:flex flex-col w-52 flex-shrink-0 sticky top-0 h-screen overflow-y-auto"
      style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)' }}
    >
      {/* Logo */}
      <div className="px-4 pt-5 pb-6">
        <DolphinLogo dark size="sm" />
        <p
          className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: 'var(--sidebar-muted)' }}
        >
          Cost Intelligence
        </p>
      </div>

      {/* Section label */}
      <div className="px-4 mb-1">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: 'var(--sidebar-muted)', opacity: 0.6 }}
        >
          Platform
        </span>
      </div>

      {/* Main nav */}
      <div className="flex-1 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <SidebarItem key={to} to={to} label={label} Icon={Icon} />
        ))}
      </div>

      {/* Divider */}
      <div className="mx-4 my-3" style={{ borderTop: '1px solid var(--sidebar-border)' }} />

      {/* Section label */}
      <div className="px-4 mb-1">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: 'var(--sidebar-muted)', opacity: 0.6 }}
        >
          Configure
        </span>
      </div>

      {/* Bottom nav */}
      <div className="px-2 pb-4 space-y-0.5">
        {NAV_BOTTOM.map(({ to, label, icon: Icon }) => (
          <SidebarItem key={to} to={to} label={label} Icon={Icon} />
        ))}
      </div>

      {/* Demo badge */}
      <div className="mx-3 mb-4 px-3 py-2 rounded-[8px]" style={{ background: 'rgba(200,144,96,0.10)', border: '1px solid rgba(200,144,96,0.18)' }}>
        <p className="text-[10px] font-semibold" style={{ color: 'var(--sidebar-accent)' }}>DEMO MODE</p>
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--sidebar-muted)' }}>Displaying sample data</p>
      </div>
    </nav>
  )
}

// ---- Mobile nav -------------------------------------------

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const allItems = [...NAV_ITEMS, ...NAV_BOTTOM]
  const currentItem = allItems.find((i) => location.pathname.startsWith(i.to))

  return (
    <header
      className="lg:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-50"
      style={{ background: 'var(--sidebar-bg)', borderBottom: '1px solid var(--sidebar-border)' }}
    >
      <DolphinLogo dark size="sm" />

      <div className="flex items-center gap-3">
        {currentItem && (
          <span className="text-[12px] font-medium" style={{ color: 'var(--sidebar-muted)' }}>
            {currentItem.label}
          </span>
        )}
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-[6px] transition-colors"
          style={{ color: 'var(--sidebar-ink)' }}
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-50"
              style={{ background: 'rgba(0,0,0,0.55)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="fixed top-0 right-0 bottom-0 w-64 z-50 flex flex-col overflow-y-auto"
              style={{ background: 'var(--sidebar-bg)', borderLeft: '1px solid var(--sidebar-border)' }}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-5">
                <DolphinLogo dark size="sm" />
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-[6px]"
                  style={{ color: 'var(--sidebar-muted)' }}
                  aria-label="Close menu"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Nav items */}
              <div className="flex-1 px-2 space-y-0.5">
                {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center justify-between px-3 py-3 rounded-[8px] text-[13px] font-medium transition-all',
                        isActive
                          ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-ink)]'
                          : 'text-[var(--sidebar-muted)]',
                      )
                    }
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={15} />
                      {label}
                    </div>
                    <ChevronRight size={12} className="opacity-40" />
                  </NavLink>
                ))}
              </div>

              <div className="mx-4 my-3" style={{ borderTop: '1px solid var(--sidebar-border)' }} />

              <div className="px-2 pb-4 space-y-0.5">
                {NAV_BOTTOM.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-3 rounded-[8px] text-[13px] font-medium transition-all',
                        isActive
                          ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-ink)]'
                          : 'text-[var(--sidebar-muted)]',
                      )
                    }
                  >
                    <Icon size={15} />
                    {label}
                  </NavLink>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}
