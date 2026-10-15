import { randomBytes } from 'node:crypto'
import { sendBanEmail, sendWelcomeEmail } from './affiliateMail.js'
import {
  creditSale,
  adminExists,
  adminProfile,
  banAffiliate,
  login,
  loginWithAdminKey,
  programRoster,
  resetEarnings,
  readSession,
  requestPayout,
  saveLink,
  signSession,
  signup,
  statsFor,
  trackClick,
  unbanAffiliate,
  userById,
  validSlug,
  normalizeSlug,
} from './affiliateStore.js'

const COOKIE = 'bd_session'
const REF_COOKIE = 'bd_ref'
const VISITOR_COOKIE = 'bd_vid'
const REF_MAX_AGE = 60 * 60 * 24 * 30
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365
const SESSION_MAX_AGE = 60 * 60 * 24 * 14

const attempts = new Map()

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = []
  req.on('data', (chunk) => chunks.push(chunk))
  req.on('end', () => {
    const raw = Buffer.concat(chunks)
    if (!raw.length) {
      resolve({})
      return
    }
    try {
      resolve(JSON.parse(raw.toString('utf8')))
    } catch {
      const error = new Error('Invalid request')
      error.status = 400
      reject(error)
    }
  })
  req.on('error', reject)
})

const readRaw = (req) => new Promise((resolve, reject) => {
  const chunks = []
  req.on('data', (chunk) => chunks.push(chunk))
  req.on('end', () => resolve(Buffer.concat(chunks)))
  req.on('error', reject)
})

export const readCookies = (req) => {
  const out = {}
  for (const part of String(req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=')
    if (index === -1) continue
    out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim())
  }
  return out
}

const clientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim()
  return req.socket?.remoteAddress || ''
}

const sameOrigin = (req) => {
  const origin = req.headers.origin
  if (!origin) return true
  try {
    return new URL(origin).host === req.headers.host
  } catch {
    return false
  }
}

const cookie = (name, value, maxAge, secure) => {
  const age = maxAge == null ? '' : `; Max-Age=${maxAge}`
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${age}${secure ? '; Secure' : ''}`
}

const send = (res, status, body, extra = []) => {
  res.statusCode = status
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json')
  if (extra.length) res.setHeader('Set-Cookie', extra)
  res.end(JSON.stringify(body))
  return true
}

const limited = (ip) => {
  const now = Date.now()
  const recent = (attempts.get(ip) || []).filter((time) => now - time < 10 * 60 * 1000)
  if (recent.length >= 8) return true
  recent.push(now)
  attempts.set(ip, recent)
  return false
}

const currentUser = async (req) => {
  const session = await readSession(readCookies(req)[COOKIE] || '')
  if (!session) return null
  if (session.role === 'admin') {
    return (await adminProfile()) || { id: 'admin', email: 'Program Admin', name: 'Program Admin', role: 'admin' }
  }
  return userById(session.id)
}

const requireAdmin = async (req) => {
  const user = await currentUser(req)
  if (!user || user.banned) {
    const error = new Error('Sign in to open your dashboard.')
    error.status = 401
    throw error
  }
  if (user.role !== 'admin') {
    const error = new Error('Program login required.')
    error.status = 403
    throw error
  }
  return user
}

const requestIsSecure = (req) => (req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https'

const requireUser = async (req) => {
  const user = await currentUser(req)
  if (!user || user.banned) {
    const error = new Error(user?.banned ? "You have been banned for violating the terms of service of our company's policy." : 'Sign in to open your dashboard.')
    error.status = user?.banned ? 403 : 401
    if (user?.banned) error.code = 'banned'
    throw error
  }
  return user
}

// Payment Links carry "<product-id>__<affiliate-link>" in client_reference_id.
export async function creditPaidCheckout(session) {
  if (!session || session.payment_status !== 'paid') return null
  const [refProduct = '', refSlug = ''] = String(session.client_reference_id || '').split('__')
  return creditSale({
    orderId: session.id,
    slug: session.metadata?.affiliateSlug || refSlug,
    totalCents: session.amount_subtotal ?? session.amount_total,
    productId: session.metadata?.productId || refProduct,
  })
}

export async function handleStripeWebhook(raw, signature) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const key = process.env.STRIPE_SECRET_KEY
  if (!secret || !key) {
    const error = new Error('Stripe webhook is not configured')
    error.status = 503
    throw error
  }
  const { default: Stripe } = await import('stripe')
  const stripe = new Stripe(key)
  const event = stripe.webhooks.constructEvent(raw, signature, secret)
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    await creditPaidCheckout(event.data.object)
  }
  return { received: true }
}

const redirect = (res, location, cookies) => {
  res.statusCode = 302
  res.setHeader('Location', location)
  res.setHeader('Cache-Control', 'no-store')
  if (cookies.length) res.setHeader('Set-Cookie', cookies)
  res.end()
  return true
}

export async function handleAffiliateRequest(req, res) {
  const [url, query = ''] = (req.url || '').split('?')
  const params = new URLSearchParams(query)
  const secure = requestIsSecure(req)
  const refRoute = url.match(/^\/ref\/([a-zA-Z0-9-]+)\/?$/)

  try {
    if ((url === '/' || url === '/index.html') && params.get('ref')) {
      const slug = normalizeSlug(params.get('ref'))
      params.delete('ref')
      const next = params.toString()
      const cookies = []
      const jar = readCookies(req)
      let visitor = jar[VISITOR_COOKIE]
      if (!visitor) {
        visitor = randomBytes(16).toString('hex')
        cookies.push(cookie(VISITOR_COOKIE, visitor, VISITOR_MAX_AGE, secure))
      }
      if (validSlug(slug)) {
        const tracked = await trackClick({ slug, ip: clientIp(req), visitorId: visitor, userAgent: req.headers['user-agent'] })
        if (tracked.ok) cookies.push(cookie(REF_COOKIE, tracked.slug, REF_MAX_AGE, secure))
      }
      return redirect(res, `/${next ? `?${next}` : ''}`, cookies)
    }

    const vanity = url.match(/^\/([a-zA-Z0-9-]+)\/?$/)
    if (vanity && (req.method === 'GET' || req.method === 'HEAD')) {
      const slug = normalizeSlug(vanity[1])
      if (validSlug(slug)) {
        const jar = readCookies(req)
        const cookies = []
        let visitor = jar[VISITOR_COOKIE]
        if (!visitor) {
          visitor = randomBytes(16).toString('hex')
          cookies.push(cookie(VISITOR_COOKIE, visitor, VISITOR_MAX_AGE, secure))
        }
        const tracked = await trackClick({ slug, ip: clientIp(req), visitorId: visitor, userAgent: req.headers['user-agent'] })
        if (tracked.ok) {
          cookies.push(cookie(REF_COOKIE, tracked.slug, REF_MAX_AGE, secure))
          return redirect(res, '/', cookies)
        }
      }
    }

    if (refRoute && (req.method === 'GET' || req.method === 'HEAD')) {
      const slug = normalizeSlug(refRoute[1])
      const jar = readCookies(req)
      const cookies = []
      let visitor = jar[VISITOR_COOKIE]
      if (!visitor) {
        visitor = randomBytes(16).toString('hex')
        cookies.push(cookie(VISITOR_COOKIE, visitor, VISITOR_MAX_AGE, secure))
      }
      const tracked = await trackClick({ slug, ip: clientIp(req), visitorId: visitor, userAgent: req.headers['user-agent'] })
      if (tracked.ok) cookies.push(cookie(REF_COOKIE, tracked.slug, REF_MAX_AGE, secure))
      return redirect(res, '/', cookies)
    }

    if (url === '/api/stripe/webhook' && req.method === 'POST') {
      const raw = await readRaw(req)
      const result = await handleStripeWebhook(raw, req.headers['stripe-signature'] || '')
      return send(res, 200, result)
    }

    if (!url.startsWith('/api/affiliate/')) return false
    if (!sameOrigin(req)) return send(res, 403, { error: 'Request blocked.' })

    if (url === '/api/affiliate/signup' && req.method === 'POST') {
      if (limited(clientIp(req))) return send(res, 429, { error: 'Too many attempts. Wait a few minutes.' })
      const body = await readBody(req)
      const user = await signup(body)
      const origin = `${secure ? 'https' : 'http'}://${req.headers.host}`
      await sendWelcomeEmail({ email: user.email, name: user.name, origin }).catch((error) => {
        console.error('Welcome email was not sent', error.message)
      })
      const token = await signSession(user.id)
      return send(res, 200, { user }, [cookie(COOKIE, token, SESSION_MAX_AGE, secure)])
    }

    if (url === '/api/affiliate/login' && req.method === 'POST') {
      if (limited(clientIp(req))) return send(res, 429, { error: 'Too many attempts. Wait a few minutes.' })
      const body = await readBody(req)
      const user = await login(body)
      const token = await signSession(user.id, user.role || 'affiliate')
      return send(res, 200, { user }, [cookie(COOKIE, token, SESSION_MAX_AGE, secure)])
    }

    if (url === '/api/affiliate/admin-key' && req.method === 'POST') {
      if (limited(clientIp(req))) return send(res, 429, { error: 'Too many attempts. Wait a few minutes.' })
      const body = await readBody(req)
      const user = await loginWithAdminKey(body.key)
      const token = await signSession(user.id, 'admin')
      return send(res, 200, { user }, [cookie(COOKIE, token, SESSION_MAX_AGE, secure)])
    }

    if (url === '/api/affiliate/admin' && req.method === 'GET') {
      return send(res, 200, { exists: await adminExists() })
    }

    // Whoever called this first would become program admin, so admins sign in with a Discord bot key instead.
    if (url === '/api/affiliate/admin' && req.method === 'POST') {
      return send(res, 403, { error: 'Program login uses an Affiliate Admin key from the Blank Delay Discord bot.' })
    }

    if (url === '/api/affiliate/roster' && req.method === 'GET') {
      await requireAdmin(req)
      return send(res, 200, await programRoster())
    }

    if (url === '/api/affiliate/reset-earnings' && req.method === 'POST') {
      await requireAdmin(req)
      const body = await readBody(req)
      return send(res, 200, await resetEarnings(body.userId || ''))
    }

    if (url === '/api/affiliate/ban' && req.method === 'POST') {
      await requireAdmin(req)
      const body = await readBody(req)
      const result = await banAffiliate(body.email)
      const origin = `${secure ? 'https' : 'http'}://${req.headers.host}`
      let emailed = false
      try {
        const mail = await sendBanEmail({ email: result.email, name: result.name, origin })
        emailed = Boolean(mail.sent)
      } catch (error) {
        console.error('Ban email was not sent', error.message)
      }
      return send(res, 200, { ...result, emailed })
    }

    if (url === '/api/affiliate/unban' && req.method === 'POST') {
      await requireAdmin(req)
      const body = await readBody(req)
      return send(res, 200, await unbanAffiliate(body.email))
    }

    if (url === '/api/affiliate/logout' && req.method === 'POST') {
      return send(res, 200, { ok: true }, [cookie(COOKIE, '', 0, secure)])
    }

    if (url === '/api/affiliate/me' && req.method === 'GET') {
      const user = await currentUser(req)
      if (user?.banned) return send(res, 200, { user: null, banned: true })
      return send(res, 200, { user })
    }

    if (url === '/api/affiliate/stats' && req.method === 'GET') {
      const user = await requireUser(req)
      return send(res, 200, await statsFor(user.id))
    }

    if (url === '/api/affiliate/create-link' && req.method === 'POST') {
      const user = await requireUser(req)
      const body = await readBody(req)
      const link = await saveLink(user.id, body.slug)
      return send(res, 200, link)
    }

    if (url === '/api/affiliate/payout' && req.method === 'POST') {
      const user = await requireUser(req)
      const body = await readBody(req)
      const payout = await requestPayout(user.id, body.amountCents)
      return send(res, 200, { payout, ...(await statsFor(user.id)) })
    }

    return send(res, 404, { error: 'Not found' })
  } catch (error) {
    const status = error.status || (error.type === 'StripeSignatureVerificationError' ? 400 : 500)
    return send(res, status, { error: error.message || 'Request failed', code: error.code || '' })
  }
}

export function referralFrom(req) {
  return normalizeSlug(readCookies(req)[REF_COOKIE] || '')
}
