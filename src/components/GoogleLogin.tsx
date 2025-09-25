import { useEffect, useRef } from 'react'
import { useAuth } from '../auth/AuthContext'

declare global {
  interface Window { google?: any }
}

export default function GoogleLoginButton() {
  const divRef = useRef<HTMLDivElement>(null)
  const { loginWithGoogleCredential } = useAuth()
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  useEffect(() => {
    if (!clientId) return
    let script: HTMLScriptElement | null = document.querySelector('script#gis')
    const init = () => {
      if (!window.google || !divRef.current) return
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (resp: any) => {
          if (resp?.credential) loginWithGoogleCredential(resp.credential)
        },
      })
      window.google.accounts.id.renderButton(divRef.current, { theme: 'outline', size: 'large' })
    }

    if (!script) {
      script = document.createElement('script')
      script.id = 'gis'
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = init
      document.head.appendChild(script)
    } else {
      init()
    }
  }, [clientId, loginWithGoogleCredential])

  if (!clientId) {
    return <div className="muted">Set VITE_GOOGLE_CLIENT_ID in .env to enable Google Sign-In.</div>
  }
  return <div ref={divRef} />
}

