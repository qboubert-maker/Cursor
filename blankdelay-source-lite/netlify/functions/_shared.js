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
  'fps-boost': 'https://buy.stripe.com/cNi8wI0QqbA6dyLb6F9bO0b',
  'controller-macro': 'https://buy.stripe.com/6oUbIU1Uu47EfGTcaJ9bO09',
  'keyboard-macro': 'https://buy.stripe.com/8x2bIU1UugUq0LZeiR9bO08',
  'zero-delay-os': 'https://buy.stripe.com/4gM4gsdDc47E2U7eiR9bO0e',
  'premium-utility': 'https://buy.stripe.com/9B628kdDc7jQdyL4Ih9bO0d',
  'aim-bundle': 'https://buy.stripe.com/8x28wI7eObA666j7Ut9bO07',
}

const PRICES = {
  'fps-boost': 1599,
  'controller-macro': 2599,
  'keyboard-macro': 2599,
  'zero-delay-os': 1599,
  'premium-utility': 3299,
}

const DOWNLOADS = {
  'fps-boost': 'https://github.com/qboubert-maker/Cursor/releases/download/blankdelay-desktop-v2/BlankDelay-Setup.exe',
  'keyboard-macro': 'https://github.com/qboubert-maker/Cursor/releases/download/blankdelay-desktop-v2/BlankDelay-Setup.exe',
  'zero-delay-os': 'https://github.com/qboubert-maker/Cursor/releases/download/blankdelay-desktop-v2/BlankDelay-Setup.exe',
  'premium-utility': 'https://github.com/qboubert-maker/Cursor/releases/download/blankdelay-desktop-v2/BlankDelay-Setup.exe',
  'aim-bundle': 'https://github.com/qboubert-maker/Cursor/releases/download/blankdelay-desktop-v2/BlankDelay-Setup.exe',
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

async function ensureReturnUrl(paymentUrl, site) {
  if (!process.env.STRIPE_SECRET_KEY) return
  const slug = new URL(paymentUrl).pathname.replace(/^\//, '')
  const target = `${site}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`
  const listed = await stripeRequest('GET', '/payment_links', { limit: '100' })
  const link = (listed.data || []).find((item) => String(item.url || '').includes(slug))
  if (!link) return
  if (link.after_completion?.type === 'redirect' && link.after_completion?.redirect?.url === target) return
  await stripeRequest('POST', `/payment_links/${link.id}`, {
    'after_completion[type]': 'redirect',
    'after_completion[redirect][url]': target,
  })
}

async function createSession(productId, site) {
  const product = PRODUCTS[productId]
  const amount = PRICES[productId]
  if (!product || !amount) {
    const error = new Error('Unknown product')
    error.status = 400
    throw error
  }
  const session = await stripeRequest('POST', '/checkout/sessions', {
    mode: 'payment',
    success_url: `${site}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/`,
    client_reference_id: productId,
    'metadata[productId]': productId,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(amount),
    'line_items[0][price_data][product_data][name]': product.name,
    'line_items[0][price_data][product_data][description]': product.name,
  })
  return session.url
}

function productFromSession(session) {
  const ref = String(session.client_reference_id || session.metadata?.productId || '').trim()
  if (PRODUCTS[ref]) return PRODUCTS[ref]
  return null
}

async function readSession(sessionId) {
  const session = await stripeRequest('GET', `/checkout/sessions/${encodeURIComponent(sessionId)}`)
  const product = productFromSession(session)
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
  createSession,
  readSession,
}
