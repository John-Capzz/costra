import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { AuthSessionResponse, AuthUser } from './api-client'
import { costraApi, ApiClientError } from './api-client'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  error: string | null
  login(email: string, password: string): Promise<void>
  logout(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void costraApi.getCurrentUser().then((session) => {
      if (active) { setUser(session.user); setLoading(false) }
    }).catch((reason: unknown) => {
      if (!active) return
      setUser(null)
      setLoading(false)
      if (!(reason instanceof ApiClientError) || reason.status !== 401) setError('Unable to check the COSTRA session.')
    })
    return () => { active = false }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    error,
    async login(email, password) {
      setError(null)
      const session: AuthSessionResponse = await costraApi.login(email, password)
      setUser(session.user)
    },
    async logout() {
      await costraApi.logout()
      setUser(null)
    },
  }), [user, loading, error])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider.')
  return context
}
