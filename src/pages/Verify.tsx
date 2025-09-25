import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Spinner from '../components/Spinner'
import { useAuth } from '../auth/AuthContext'

function useQuery() {
  return new URLSearchParams(useLocation().search)
}

export default function VerifyPage() {
  const query = useQuery()
  const nav = useNavigate()
  const { user } = useAuth()
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    const token = query.get('token')
    const email = query.get('email')
    if (!token || !email) {
      setStatus('error')
      setMessage('Invalid verification link')
      return
    }
    setStatus('loading')
    fetch(`/api/email/verify-link/validate?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`)
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok || !data.ok) throw new Error(data?.message || 'Invalid or expired token')
        setStatus('ok')
        setMessage('Your email has been verified. You can continue.')
      })
      .catch((e) => {
        setStatus('error')
        setMessage(e?.message || 'Verification failed')
      })
  }, [])

  return (
    <div className="card" style={{ maxWidth: 560, margin: '32px auto' }}>
      <h2>Email Verification</h2>
      {status === 'loading' && <div className="row"><Spinner /> Verifying…</div>}
      {status !== 'loading' && (
        <>
          <p style={{ color: status === 'ok' ? '#34d399' : '#ffb44b' }}>{message}</p>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn-lg" onClick={() => nav('/')} disabled={!user}>
              Go to App
            </button>
          </div>
        </>
      )}
    </div>
  )
}

