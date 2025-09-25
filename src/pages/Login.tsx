import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import GoogleLoginButton from '../components/GoogleLogin'
import Spinner from '../components/Spinner'

export default function LoginPage() {
  const { loginLocal } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()
  const location = useLocation() as any
  const from = location.state?.from?.pathname || '/'

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await loginLocal(email, password)
      nav(from, { replace: true })
    } catch (err: any) {
      setError(err?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ maxWidth: 420, margin: '32px auto' }}>
      <h2>Sign In</h2>
      <form onSubmit={onSubmit} className="col">
        <label>
          <div>Email</div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          <div>Password</div>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button className="btn-lg" disabled={loading}>
          {loading ? <span className="row"><Spinner /> Logging in…</span> : 'Login'}
        </button>
      </form>
      {error && <div className="error" style={{ marginTop: 8 }}>{error}</div>}
      <div className="row" style={{ marginTop: 12, justifyContent: 'space-between' }}>
        <Link to="/register">Create account</Link>
        <button
          className="btn-ghost"
          onClick={async () => {
            try {
              setError(null)
              setLoading(true)
              const r = await fetch('/api/email/verify-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
              })
              const data = await r.json()
              if (!r.ok) throw new Error(data?.message || 'Failed')
              alert(`Verification link sent.${data?.previewUrl ? `\nPreview (dev): ${data.previewUrl}` : ''}`)
            } catch (e: any) {
              setError(e?.message || 'Failed to send verification')
            } finally {
              setLoading(false)
            }
          }}
          disabled={loading || !email}
        >
          Resend verify link
        </button>
      </div>

      <div style={{ height: 1, background: '#2b3264', margin: '12px 0' }} />
      <h3 style={{ marginTop: 0 }}>Or use OTP</h3>
      <div className="row" style={{ gap: 8, alignItems: 'stretch' }}>
        <input
          placeholder="6-digit OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          style={{ flex: 1 }}
        />
        <button
          className="btn-outline"
          onClick={async () => {
            try {
              setError(null)
              setLoading(true)
              const r = await fetch('/api/email/otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
              })
              const data = await r.json()
              if (!r.ok) throw new Error(data?.message || 'Failed')
              alert(`OTP sent.${data?.previewUrl ? `\nPreview (dev): ${data.previewUrl}` : ''}`)
            } catch (e: any) {
              setError(e?.message || 'Failed to send OTP')
            } finally {
              setLoading(false)
            }
          }}
          disabled={loading || !email}
        >
          Send OTP
        </button>
        <button
          className="btn-lg btn-success"
          onClick={async () => {
            try {
              setError(null)
              setLoading(true)
              const r = await fetch('/api/email/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code: otp }),
              })
              const data = await r.json()
              if (!r.ok || !data?.ok) throw new Error(data?.message || 'Invalid OTP')
              alert('OTP verified. You can login now.')
            } catch (e: any) {
              setError(e?.message || 'OTP verify failed')
            } finally {
              setLoading(false)
            }
          }}
          disabled={loading || !email || otp.length < 4}
        >
          Verify OTP
        </button>
      </div>
      <div style={{ height: 1, background: '#2b3264', margin: '12px 0' }} />
      <GoogleLoginButton />
    </div>
  )
}
