import type { Request, Response } from 'express'

export const SESSION_COOKIE = 'costra_session'

export function getCookie(req: Request, name: string): string | null {
  const header = req.get('cookie')
  if (!header) return null
  for (const entry of header.split(';')) {
    const [key, ...value] = entry.trim().split('=')
    if (key === name) return decodeURIComponent(value.join('='))
  }
  return null
}

function cookieOptions(): string {
  const secure = process.env.COSTRA_ENV === 'staging' || process.env.COSTRA_ENV === 'production'
  return `Path=/; SameSite=Lax${secure ? '; Secure' : ''}`
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; ${cookieOptions()}; Expires=${expiresAt.toUTCString()}`)
}

export function clearSessionCookie(res: Response): void {
  res.append('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; ${cookieOptions()}; Max-Age=0`)
}
