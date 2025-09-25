export interface CreditSpendPayload {
  memberId: string
  productId: string
  membershipTierId: string
  amount: number
}

export interface CreditSpendResponse {
  success: boolean
  message?: string
  // backend shape is unknown; keep generic container
  data?: unknown
}

const API_BASE = import.meta.env.DEV ? '/mayar' : 'https://api.mayar.club'
const CREDIT_ENDPOINT = `${API_BASE}/credit/v1/credit/customer/spend`

export async function spendCredit(payload: CreditSpendPayload): Promise<CreditSpendResponse> {
  const apiKey = import.meta.env.VITE_API_KEY
  if (!apiKey) {
    throw new Error('VITE_API_KEY is missing. Add it to your .env file.')
  }

  const res = await fetch(CREDIT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  const contentType = res.headers.get('content-type') || ''
  const maybeJson = contentType.includes('application/json')

  if (!res.ok) {
    const errPayload = maybeJson ? await res.json().catch(() => ({})) : await res.text()
    throw new Error(
      typeof errPayload === 'string'
        ? `Credit spend failed: ${res.status} ${res.statusText} - ${errPayload}`
        : `Credit spend failed: ${res.status} ${res.statusText} - ${JSON.stringify(errPayload)}`,
    )
  }

  const data = maybeJson ? await res.json() : undefined
  return {
    success: true,
    data,
  }
}

export interface CreditBalanceQuery {
  memberId: string
  membershipTierId: string
  productId: string
}

export interface CreditBalanceResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
}

export async function getCreditBalance<T = unknown>(query: CreditBalanceQuery): Promise<CreditBalanceResponse<T>> {
  const apiKey = import.meta.env.VITE_API_KEY
  if (!apiKey) {
    throw new Error('VITE_API_KEY is missing. Add it to your .env file.')
  }
  const url = new URL(`${API_BASE}/credit/v1/credit/customer/balance`, location.origin)
  url.searchParams.set('productId', query.productId)
  url.searchParams.set('membershipTierId', query.membershipTierId)
  url.searchParams.set('memberId', query.memberId)

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    redirect: 'follow',
  })

  const contentType = res.headers.get('content-type') || ''
  const maybeJson = contentType.includes('application/json')

  if (!res.ok) {
    const errPayload = maybeJson ? await res.json().catch(() => ({})) : await res.text()
    const retryAfter = res.headers.get('retry-after') || undefined
    const message =
      typeof errPayload === 'string'
        ? `Balance fetch failed: ${res.status} ${res.statusText} - ${errPayload}`
        : `Balance fetch failed: ${res.status} ${res.statusText} - ${JSON.stringify(errPayload)}`
    const err: any = new Error(message)
    err.status = res.status
    err.payload = errPayload
    err.retryAfter = retryAfter
    throw err
  }

  const data = (maybeJson ? await res.json() : undefined) as T | undefined
  return { success: true, data }
}

export interface CreditHistoryQuery {
  productId: string
  membershipTierId: string
  memberId: string
  page?: number
  limit?: number
}

export interface CreditHistoryResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
}

export async function getCreditHistory<T = unknown>(query: CreditHistoryQuery): Promise<CreditHistoryResponse<T>> {
  const apiKey = import.meta.env.VITE_API_KEY
  if (!apiKey) throw new Error('VITE_API_KEY is missing. Add it to your .env file.')

  const override = import.meta.env.VITE_HISTORY_ENDPOINT
  const candidatesBase = override
    ? [override]
    : [
        // Prefer proxied relative path in dev to dodge CORS preflight
        `${API_BASE}/credit/v1/credit/customer/paginate-credit-history`,
        // Fallback variant without "/credit" prefix
        `${API_BASE}/v1/credit/customer/paginate-credit-history`,
      ]

  const buildUrl = (base: string) => {
    const applyTemplate = (s: string) =>
      s.replace(/\{(memberId|productId|membershipTierId|page|limit)\}/g, (_m, k) => {
        const map: Record<string, string> = {
          memberId: query.memberId,
          productId: query.productId,
          membershipTierId: query.membershipTierId,
          page: String(query.page ?? 1),
          limit: String(query.limit ?? 50),
        }
        return encodeURIComponent(map[k])
      })

    const hadMemberPlaceholder = base.includes('{memberId}')
    const hadPagePlaceholder = base.includes('{page}')
    const hadLimitPlaceholder = base.includes('{limit}')
    const hadProductPlaceholder = base.includes('{productId}')
    const hadTierPlaceholder = base.includes('{membershipTierId}')

    let templated = applyTemplate(base)

    // If in dev and absolute to api.mayar.club, rewrite to proxied relative path
    if (import.meta.env.DEV && /^https:\/\/api\.mayar\.club/i.test(templated)) {
      templated = templated.replace(/^https:\/\/api\.mayar\.club/i, API_BASE)
    }

    // If base is absolute, URL(base). If relative, construct against current origin
    const u = templated.startsWith('http') ? new URL(templated) : new URL(templated, location.origin)

    // Ensure params are set/overridden if not provided in path/template
    if (!hadProductPlaceholder) u.searchParams.set('productId', query.productId)
    if (!hadTierPlaceholder) u.searchParams.set('membershipTierId', query.membershipTierId)
    if (!hadMemberPlaceholder) u.searchParams.set('memberId', query.memberId)
    if (!hadPagePlaceholder) u.searchParams.set('page', String(query.page ?? 1))
    if (!hadLimitPlaceholder) u.searchParams.set('limit', String(query.limit ?? 10))
    return u
  }

  const tryFetch = async (u: URL) => {
    const res = await fetch(u.toString(), {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      redirect: 'follow',
    })
    const contentType = res.headers.get('content-type') || ''
    const maybeJson = contentType.includes('application/json')
    return { res, maybeJson }
  }

  // Iterate possible base URLs, try both without and with trailing slash
  let lastErr: { status: number; body?: unknown; text?: string } | null = null
  for (const base of candidatesBase) {
    for (const withSlash of [false, true]) {
      const url = buildUrl(withSlash ? `${base.replace(/\/$/, '')}/` : base.replace(/\/$/, ''))
      const attempt = await tryFetch(url)
      if (attempt.res.ok) {
        const data = (attempt.maybeJson ? await attempt.res.json() : undefined) as T | undefined
        return { success: true, data }
      }
      if (attempt.res.status !== 404) {
        const errPayload = attempt.maybeJson ? await attempt.res.json().catch(() => ({})) : await attempt.res.text()
        throw new Error(
          typeof errPayload === 'string'
            ? `History fetch failed: ${attempt.res.status} ${attempt.res.statusText} - ${errPayload}`
            : `History fetch failed: ${attempt.res.status} ${attempt.res.statusText} - ${JSON.stringify(errPayload)}`,
        )
      } else {
        lastErr = { status: attempt.res.status, text: await attempt.res.text().catch(() => undefined) }
      }
    }
  }

  // If all candidates 404
  throw new Error(
    `History fetch failed: 404 - endpoint not found. Configure VITE_HISTORY_ENDPOINT to the correct path (e.g. https://api.mayar.club/credit/v1/credit/customer/paginate-credit-history).`
  )
}
