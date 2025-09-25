import { useEffect, useRef, useState } from 'react'
import { spendCredit, type CreditSpendPayload, getCreditBalance, getCreditHistory } from './api/credit'
import Spinner from './components/Spinner'
import { Toasts, type ToastItem } from './components/Toast'
import { useAuth } from './auth/AuthContext'

type BasePayload = Omit<CreditSpendPayload, 'productId'>
const MEMBER_ID = import.meta.env.VITE_MEMBER_ID || '2NIENX01'
const MEMBERSHIP_TIER_ID = import.meta.env.VITE_MEMBERSHIP_TIER_ID || '5ab9a7fe-3432-4d9c-ae4c-f32dae770cd2'
const BASE_PAYLOAD: BasePayload = {
  memberId: MEMBER_ID,
  membershipTierId: MEMBERSHIP_TIER_ID,
  amount: 5,
}

const IMAGE_URL = 'https://picsum.photos/300'
const MUSIC_URL_ENV = import.meta.env.VITE_MUSIC_URL
const PRODUCT_ID_IMAGE = import.meta.env.VITE_PRODUCT_ID_IMAGE || 'image-gen'
const PRODUCT_ID_MUSIC = import.meta.env.VITE_PRODUCT_ID_MUSIC || 'music-gen'
const PRODUCT_ID_BALANCE = import.meta.env.VITE_PRODUCT_ID_BALANCE || PRODUCT_ID_IMAGE

export default function App() {
  const { user, logout } = useAuth()
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [musicUrl, setMusicUrl] = useState<string | null>(null)
  const [loadingImage, setLoadingImage] = useState(false)
  const [loadingMusic, setLoadingMusic] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null)
  const lastBalanceFetchRef = useRef(0)
  const [history, setHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyHasMore, setHistoryHasMore] = useState(true)
  const [historyMeta, setHistoryMeta] = useState<{ total?: number; totalPages?: number; page?: number; limit?: number } | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [showSidebar, setShowSidebar] = useState(false)

  function extractBalance(data: any): number | null {
    if (!data) return null
    // Mayar response shape
    if (typeof data.customerBalance === 'number') return data.customerBalance
    if (typeof data.customerBalanceMembership === 'number' && typeof data.customerBalance !== 'number') {
      return data.customerBalanceMembership
    }
    if (typeof data.customerBalanceAddon === 'number' && typeof data.customerBalance !== 'number') {
      return data.customerBalanceAddon
    }
    if (typeof data.balance === 'number') return data.balance
    if (data.data) {
      if (typeof data.data.balance === 'number') return data.data.balance
      if (typeof data.data.available === 'number') return data.data.available
      if (typeof data.data.remaining === 'number') return data.data.remaining
    }
    if (typeof data.available === 'number') return data.available
    if (typeof data.remaining === 'number') return data.remaining
    return null
  }

  async function refreshBalance(force = false) {
    setLoadingBalance(true)
    try {
      const now = Date.now()
      if (rateLimitedUntil && now < rateLimitedUntil) {
        // still rate limited
        return
      }
      if (!force && now - lastBalanceFetchRef.current < 3500) {
        // throttle to ~17-18 req/min
        return
      }
      const res = await getCreditBalance({
        memberId: BASE_PAYLOAD.memberId,
        membershipTierId: BASE_PAYLOAD.membershipTierId,
        productId: PRODUCT_ID_BALANCE,
      })
      const value = extractBalance(res.data)
      setBalance(value)
      lastBalanceFetchRef.current = now
      setRateLimitedUntil(null)
    } catch (e: any) {
      setBalance(null)
      if (e && (e.status === 429 || String(e?.message || '').includes('429'))) {
        const retrySec = Number.parseInt(e?.retryAfter ?? '60', 10)
        const retryMs = Number.isFinite(retrySec) ? retrySec * 1000 : 60_000
        setRateLimitedUntil(Date.now() + retryMs)
      }
      setError(e?.message || 'Gagal mengambil saldo credit')
    } finally {
      setLoadingBalance(false)
    }
  }

  useEffect(() => {
    refreshBalance(false)
    // initial history load
    void refreshHistory(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleGenerateImage() {
    setError(null)
    setLoadingImage(true)
    setImageUrl(null)
    let tempUrl: string | null = null
    try {
      // 1) Generate first
      const res = await fetch(IMAGE_URL, { redirect: 'follow' })
      if (!res.ok) throw new Error(`Image fetch failed: ${res.status} ${res.statusText}`)
      const blob = await res.blob()
      tempUrl = URL.createObjectURL(blob)

      // 2) Spend credit only if generation succeeded
      await spendCredit({ ...BASE_PAYLOAD, productId: PRODUCT_ID_IMAGE })

      // 3) Commit URL and refresh balance
      setImageUrl(tempUrl)
      await refreshBalance(true)
      await refreshHistory(true)
      pushToast({ type: 'success', message: 'Image generated and credit spent ✅' })
    } catch (e: any) {
      if (tempUrl) URL.revokeObjectURL(tempUrl)
      setError(e?.message || 'Unexpected error while generating image')
      pushToast({ type: 'error', message: e?.message || 'Gagal generate image' })
    } finally {
      setLoadingImage(false)
    }
  }

  async function handleGenerateMusic() {
    setError(null)
    setLoadingMusic(true)
    setMusicUrl(null)
    try {
      const candidates = [
        ...(MUSIC_URL_ENV ? [MUSIC_URL_ENV] : []),
        // Known public samples that typically allow cross-origin audio playback
        'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3',
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      ]

      const playable = await findPlayableMusicUrl(candidates, 8000)

      // Spend credit only after we confirm audio can play
      await spendCredit({ ...BASE_PAYLOAD, productId: PRODUCT_ID_MUSIC })

      // Set the URL directly (no blob) to avoid CORS fetch issues
      setMusicUrl(playable)
      await refreshBalance(true)
      await refreshHistory(true)
      pushToast({ type: 'success', message: 'Music ready and credit spent 🎵' })
    } catch (e: any) {
      setError(e?.message || 'Unexpected error while generating music')
      pushToast({ type: 'error', message: e?.message || 'Gagal generate music' })
    } finally {
      setLoadingMusic(false)
    }
  }

  async function findPlayableMusicUrl(urls: string[], timeoutMs = 8000): Promise<string> {
    for (const url of urls) {
      try {
        await canPlayAudio(url, timeoutMs)
        return url
      } catch {
        // try next
      }
    }
    throw new Error('Tidak dapat memuat audio dari semua sumber yang dicoba')
  }

  function canPlayAudio(src: string, timeoutMs = 8000): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio()
      audio.preload = 'auto'
      audio.crossOrigin = 'anonymous'
      const onCanPlay = () => cleanup(() => resolve())
      const onError = () => cleanup(() => reject(new Error('Audio load error'))) 
      const timer = setTimeout(() => cleanup(() => reject(new Error('Audio load timeout'))), timeoutMs)
      function cleanup(done: () => void) {
        clearTimeout(timer)
        audio.removeEventListener('canplaythrough', onCanPlay)
        audio.removeEventListener('loadeddata', onCanPlay)
        audio.removeEventListener('error', onError)
        done()
      }
      audio.addEventListener('canplaythrough', onCanPlay, { once: true })
      audio.addEventListener('loadeddata', onCanPlay, { once: true })
      audio.addEventListener('error', onError, { once: true })
      audio.src = src
      // kick off loading
      audio.load()
    })
  }

  function formatDate(input?: string): string {
    if (!input) return '—'
    const d = new Date(input)
    if (isNaN(d.getTime())) return String(input)
    return d.toLocaleString()
  }

  function formatAmount(n?: number): string {
    if (typeof n !== 'number' || isNaN(n)) return '—'
    try {
      return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n)
    } catch {
      return String(n)
    }
  }

  async function refreshHistory(reset = false) {
    setLoadingHistory(true)
    try {
      const page = reset ? 1 : historyPage
      const limit = 10
      const res = await getCreditHistory<any>({
        productId: PRODUCT_ID_BALANCE,
        membershipTierId: BASE_PAYLOAD.membershipTierId,
        memberId: BASE_PAYLOAD.memberId,
        page,
        limit,
      })
      const payload: any = res.data
      // Try common shapes
      let items: any[] = []
      let total = 0
      let totalPages: number | undefined
      let curPage: number | undefined
      let curLimit: number | undefined
      if (payload) {
        if (Array.isArray(payload.items)) {
          items = payload.items
          total = typeof payload.total === 'number' ? payload.total : 0
          totalPages = typeof payload.totalPages === 'number' ? payload.totalPages : undefined
          curPage = typeof payload.page === 'number' ? payload.page : undefined
          curLimit = typeof payload.limit === 'number' ? payload.limit : undefined
        } else if (Array.isArray(payload.data)) {
          items = payload.data
          total = typeof payload.total === 'number' ? payload.total : 0
          totalPages = typeof payload.totalPages === 'number' ? payload.totalPages : undefined
          curPage = typeof payload.page === 'number' ? payload.page : undefined
          curLimit = typeof payload.limit === 'number' ? payload.limit : undefined
        } else if (Array.isArray(payload.results)) {
          items = payload.results
          total = typeof payload.count === 'number' ? payload.count : 0
        } else if (Array.isArray(payload)) {
          items = payload
          total = payload.length
        }
      }
      setHistory((prev) => (reset ? items : [...prev, ...items]))
      const meta = { total, totalPages, page: curPage, limit: curLimit }
      setHistoryMeta(meta)
      // Determine hasMore using meta when available
      let hasMore = true
      if (typeof totalPages === 'number' && typeof curPage === 'number') {
        hasMore = curPage < totalPages
      } else {
        hasMore = items.length >= limit && (reset ? limit < (total || Infinity) : true)
      }
      setHistoryHasMore(hasMore)
      setHistoryPage(page + 1)
    } catch (e: any) {
      setError(e?.message || 'Gagal mengambil riwayat credit')
      pushToast({ type: 'error', message: e?.message || 'Gagal mengambil riwayat credit' })
    } finally {
      setLoadingHistory(false)
    }
  }

  function pushToast(t: Omit<ToastItem, 'id'>) {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, ...t }])
  }
  function removeToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div className="app">
      <div className="header">
        <div className="brand">
          <h1 style={{ margin: 0 }}>GenCredit Studio</h1>
          <span className="brand-badge">Fast • Simple • Reliable</span>
        </div>
        <div className="row">
          {user && (
            <div className="row" style={{ gap: 8, marginRight: 8 }}>
              {user.picture && <img src={user.picture} alt="avatar" width={28} height={28} style={{ borderRadius: 999 }} />}
              <span className="muted">{user.name || user.email}</span>
              <button className="btn-ghost" onClick={logout}>Logout</button>
            </div>
          )}
          <button className="btn-ghost" onClick={() => setShowSidebar((s) => !s)} aria-label="Toggle history sidebar">
            {showSidebar ? 'Close History' : 'Riwayat'}
          </button>
          <div className="balance-badge" title="Sisa Credit">
            <span className="muted">Sisa:</span>
            <span className="balance-value">{loadingBalance ? <Spinner /> : balance ?? '—'}</span>
            <button
              className="btn-ghost"
              onClick={() => refreshBalance(true)}
              disabled={loadingBalance || (rateLimitedUntil ? Date.now() < rateLimitedUntil : false)}
              aria-label="Refresh balance"
            >
              ↻
            </button>
          </div>
        </div>
      </div>
      <div className="app-body">
        {showSidebar && (
          <aside className="sidebar" aria-label="Riwayat Credit">
            <div className="side-header">
              <h2 style={{ margin: 0 }}>Riwayat Credit</h2>
              <button className="btn-ghost" onClick={() => setShowSidebar(false)} aria-label="Close sidebar">×</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, color: '#9aa3c7' }}>
              <div>Total: {historyMeta?.total ?? '—'}</div>
              <div>Page: {historyMeta?.page ?? historyPage - 1}/{historyMeta?.totalPages ?? '—'}</div>
              <div>Limit: {historyMeta?.limit ?? 50}</div>
            </div>
            <div className="side-actions">
              <button onClick={() => refreshHistory(true)} disabled={loadingHistory}>
                {loadingHistory ? 'Loading…' : 'Refresh'}
              </button>
              <button onClick={() => refreshHistory(false)} disabled={loadingHistory || !historyHasMore}>
                {loadingHistory ? 'Loading…' : historyHasMore ? 'Load More' : 'No More'}
              </button>
              <button
                onClick={async () => {
                  await refreshHistory(true)
                  for (let i = 0; i < 50; i++) {
                    if (!historyHasMore) break
                    // eslint-disable-next-line no-await-in-loop
                    await refreshHistory(false)
                  }
                }}
                disabled={loadingHistory}
              >
                {loadingHistory ? 'Loading…' : 'Load All'}
              </button>
            </div>
            {history.length === 0 && !loadingHistory ? (
              <div style={{ color: '#9aa3c7' }}>Belum ada riwayat.</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {history.map((item: any, idx) => (
                  <div key={item.id ?? idx} className="result" style={{ padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <strong>{formatDate(item.createdAt)}</strong>
                      <span style={{ color: item.amount < 0 ? '#ff6b6b' : '#34d399', fontWeight: 700 }}>
                        {formatAmount(item.amount)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6, color: '#9aa3c7' }}>
                      <span>Type: {item.type ?? '—'}</span>
                      <span>Status: {item.status ?? '—'}</span>
                      <span>Wallet: {item.walletType ?? '—'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4, color: '#9aa3c7' }}>
                      <span>Ref: {(item.referenceId ?? '—')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}
        <main className="content">
          <section className="card" style={{ marginBottom: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0 }}>Kredit</h2>
              <span className="muted">Member: {BASE_PAYLOAD.memberId}</span>
            </div>
            {rateLimitedUntil && Date.now() < rateLimitedUntil && (
              <div style={{ marginTop: 6, color: '#ffb44b' }}>
                Rate limited. Coba lagi dalam ~{Math.ceil((rateLimitedUntil - Date.now()) / 1000)}s
              </div>
            )}
          </section>

          <section className="actions">
            <button className="btn-lg" onClick={handleGenerateImage} disabled={loadingImage}>
              {loadingImage ? (
                <span className="row"><Spinner /> Generating Image…</span>
              ) : (
                'Generate Image 🖼️'
              )}
            </button>
            <button className="btn-lg btn-outline" onClick={handleGenerateMusic} disabled={loadingMusic}>
              {loadingMusic ? (
                <span className="row"><Spinner /> Preparing Music…</span>
              ) : (
                'Generate Music 🎵'
              )}
            </button>
          </section>

          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}

          <section className="results">
            {loadingImage && (
              <div className="result">
                <h3>Generated Image</h3>
                <div className="skeleton" style={{ width: 300, height: 300 }} />
              </div>
            )}
            {imageUrl && !loadingImage && (
              <div className="result">
                <h3>Generated Image</h3>
                <img src={imageUrl} alt="Generated" width={300} height={300} />
              </div>
            )}
            {musicUrl && (
              <div className="result">
                <h3>Generated Music</h3>
                <audio controls src={musicUrl} />
              </div>
            )}
          </section>
        </main>
      </div>
      <Toasts items={toasts} onClose={removeToast} />
    </div>
  )
}
