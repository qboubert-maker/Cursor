'use strict'

const PRODUCTS = {
  'fps-boost': { id: 'fps-boost', name: 'FPS Boost' },
  'controller-macro': { id: 'controller-macro', name: 'Controller Macro' },
  'keyboard-macro': { id: 'keyboard-macro', name: 'Keyboard Macro' },
  'zero-delay-os': { id: 'zero-delay-os', name: 'Zero Delay' },
  'premium-utility': { id: 'premium-utility', name: 'Premium Utility' },
  'aim-bundle': { id: 'aim-bundle', name: 'Elite Aim Bundle' },
}

const PAYMENT_LINKS = {
  'fps-boost': 'https://buy.stripe.com/28E6oAar05bIcuHdeN9bO0k',
  'controller-macro': 'https://buy.stripe.com/dRm8wIeHgdIe2U7eiR9bO0j',
  'keyboard-macro': 'https://buy.stripe.com/cNi3cobv4gUqcuHeiR9bO0i',
  'zero-delay-os': 'https://buy.stripe.com/6oU5kw56GeMigKXfmV9bO0h',
  'premium-utility': 'https://buy.stripe.com/fZu3co8iSaw2eCP1w59bO0g',
}

const DOWNLOADS = {
  'fps-boost': 'https://github.com/qboubert-maker/Cursor/releases/download/blankdelay-desktop-v2/Blank-Fps-Boost.exe',
  'keyboard-macro': 'https://github.com/qboubert-maker/Cursor/releases/download/blankdelay-desktop-v2/Blank-Keyboard-Macro.exe',
  'zero-delay-os': 'https://github.com/qboubert-maker/Cursor/releases/download/blankdelay-desktop-v2/Blank-Zero-Delay.exe',
  'premium-utility': 'https://github.com/qboubert-maker/Cursor/releases/download/blankdelay-desktop-v2/Blank-Delay-Premium.exe',
  'controller-macro': 'https://github.com/qboubert-maker/Cursor/releases/download/blankdelay-desktop-v2/Blank-Delay-Controller-Macro.exe',
}

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

function siteOrigin(origin, host) {
  try {
    const url = new URL(origin)
    if (!host || url.host === host) return url.origin
  } catch {
    /* fall through */
  }
  if (host && !String(host).includes('localhost')) return `https://${host}`
  return 'https://blankdelay.com'
}

async function stripeRequest(method, path, params) {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    const error = new Error('Stripe is not configured')
    error.status = 503
    throw error
  }
  const headers = { Authorization: `Bearer ${key}` }
  let url = `https://api.stripe.com/v1${path}`
  const init = { method, headers }
  if (method === 'GET') {
    if (params) url += `?${new URLSearchParams(params)}`
  } else {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    init.body = new URLSearchParams(params || {}).toString().replace(/%7BCHECKOUT_SESSION_ID%7D/g, '{CHECKOUT_SESSION_ID}')
  }
  const res = await fetch(url, init)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(data.error?.message || 'Stripe request failed')
    error.status = res.status
    throw error
  }
  return data
}

function paymentLinkFor(productId) {
  const base = PAYMENT_LINKS[productId]
  if (!base) {
    const error = new Error('Unknown product')
    error.status = 400
    throw error
  }
  const url = new URL(base)
  url.searchParams.set('client_reference_id', productId)
  return url.toString()
}

async function productFromSession(session) {
  const ref = String(session.client_reference_id || session.metadata?.productId || '').trim()
  if (PRODUCTS[ref] && PAYMENT_LINKS[ref]) return PRODUCTS[ref]
  if (!session.payment_link) return null
  // Someone opened the Stripe link directly, without the reference the site adds.
  const link = await stripeRequest('GET', `/payment_links/${encodeURIComponent(session.payment_link)}`)
  const match = Object.keys(PAYMENT_LINKS).find((id) => PAYMENT_LINKS[id] === link.url)
  return match ? PRODUCTS[match] : null
}

async function readSession(sessionId) {
  const session = await stripeRequest('GET', `/checkout/sessions/${encodeURIComponent(sessionId)}`)
  const product = await productFromSession(session)
  const paid = session.payment_status === 'paid' && Boolean(product)
  return {
    paid,
    productId: paid ? product.id : '',
    productName: paid ? product.name : '',
  }
}

module.exports = {
  PRODUCTS,
  DOWNLOADS,
  json,
  siteOrigin,
  paymentLinkFor,
  readSession,
}
