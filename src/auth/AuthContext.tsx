import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { AuthUser } from './types'
import * as Local from '../api/auth'

type AuthContextValue = {
  user: AuthUser | null
  loginLocal: (email: string, password: string) => Promise<void>
  registerLocal: (email: string, password: string, name?: string) => Promise<void>
  loginWithGoogleCredential: (credential: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)
const AUTH_KEY = 'auth.user'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem(AUTH_KEY)
      return raw ? (JSON.parse(raw) as AuthUser) : null
    } catch {
      return null
    }
  })

  const persist = useCallback((u: AuthUser | null) => {
    setUser(u)
    if (u) localStorage.setItem(AUTH_KEY, JSON.stringify(u))
    else localStorage.removeItem(AUTH_KEY)
  }, [])

  const loginLocal = useCallback(async (email: string, password: string) => {
    const u = Local.login(email, password)
    persist({ id: u.id, email: u.email, name: u.name, provider: 'local', verified: false })
  }, [persist])

  const registerLocal = useCallback(async (email: string, password: string, name?: string) => {
    const u = Local.register(email, password, name)
    persist({ id: u.id, email: u.email, name: u.name, provider: 'local', verified: false })
  }, [persist])

  const loginWithGoogleCredential = useCallback(async (credential: string) => {
    // decode ID token (header.payload.signature). payload is base64url JSON
    const parts = credential.split('.')
    if (parts.length < 2) throw new Error('Invalid Google credential')
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    const u: AuthUser = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      provider: 'google',
      token: credential,
    }
    persist({ ...u, verified: false })
  }, [persist])

  const logout = useCallback(() => persist(null), [persist])

  const value = useMemo<AuthContextValue>(() => ({ user, loginLocal, registerLocal, loginWithGoogleCredential, logout }), [user, loginLocal, registerLocal, loginWithGoogleCredential, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
