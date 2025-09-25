import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Spinner from '../components/Spinner'

export default function RegisterPage() {
  const { registerLocal } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await registerLocal(email, password, name)
      // After successful register, try to send verification link; fallback to OTP
      let sent = false
      try {
        const r = await fetch('/api/email/verify-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name }),
        })
        const data = await r.json()
        if (!r.ok) throw new Error(data?.message || 'Failed to send verification link')
        sent = true
        alert(`Verification link has been sent to your email.${data?.previewUrl ? `\nPreview (dev): ${data.previewUrl}` : ''}`)
      } catch (e1: any) {
        try {
          const r2 = await fetch('/api/email/otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name }),
          })
          const data2 = await r2.json()
          if (!r2.ok) throw new Error(data2?.message || 'Failed to send OTP')
          sent = true
          alert(`OTP has been sent to your email.${data2?.previewUrl ? `\nPreview (dev): ${data2.previewUrl}` : ''}`)
        } catch (e2: any) {
          setError(e2?.message || e1?.message || 'Failed to send verification')
        }
      }
      if (sent) {
        nav('/login', { replace: true })
      }
    } catch (err: any) {
      setError(err?.message || 'Register failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ maxWidth: 420, margin: '32px auto' }}>
      <h2>Create Account</h2>
      <form onSubmit={onSubmit} className="col">
        <label>
          <div>Name</div>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          <div>Email</div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          <div>Password</div>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button className="btn-lg btn-success" disabled={loading}>
          {loading ? <span className="row"><Spinner /> Creating…</span> : 'Register'}
        </button>
      </form>
      {error && <div className="error" style={{ marginTop: 8 }}>{error}</div>}
      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <button
          className="btn-outline"
          onClick={async () => {
            try {
              setError(null)
              setLoading(true)
              const r = await fetch('/api/email/otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, name }),
              })
              const data = await r.json()
              if (!r.ok) throw new Error(data?.message || 'Failed')
              alert(`OTP sent to your email.${data?.previewUrl ? `\nPreview (dev): ${data.previewUrl}` : ''}`)
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
          className="btn-outline"
          onClick={async () => {
            try {
              setError(null)
              setLoading(true)
              const r = await fetch('/api/email/verify-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, name }),
              })
              const data = await r.json()
              if (!r.ok) throw new Error(data?.message || 'Failed')
              alert(`Verification link sent to your email.${data?.previewUrl ? `\nPreview (dev): ${data.previewUrl}` : ''}`)
            } catch (e: any) {
              setError(e?.message || 'Failed to send link')
            } finally {
              setLoading(false)
            }
          }}
          disabled={loading || !email}
        >
          Send Verify Link
        </button>
      </div>
      <div className="row" style={{ marginTop: 12, justifyContent: 'space-between' }}>
        <Link to="/login">Have an account? Login</Link>
      </div>
    </div>
  )
}
