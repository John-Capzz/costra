import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { DolphinLogo } from '@/components/ui/DolphinLogo'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try { await login(email, password); navigate('/dashboard', { replace: true }) }
    catch { setError('Unable to sign in with those credentials.') }
    finally { setSubmitting(false) }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--bg)' }}>
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl p-7" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <DolphinLogo size="md" />
        <h1 className="mt-8 text-2xl font-semibold" style={{ color: 'var(--ink)' }}>Sign in to COSTRA</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>Use your authenticated browser session to access cost planning.</p>
        <label className="block mt-7 text-sm" style={{ color: 'var(--ink)' }}>Email
          <input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-md px-3 py-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
        </label>
        <label className="block mt-4 text-sm" style={{ color: 'var(--ink)' }}>Password
          <input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-md px-3 py-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
        </label>
        {error && <p role="alert" className="mt-4 text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
        <button disabled={submitting} className="mt-6 w-full rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-50" style={{ background: 'var(--accent)', color: 'white' }}>{submitting ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  )
}
