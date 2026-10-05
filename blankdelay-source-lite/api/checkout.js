import { CHECKOUT_PRODUCTS } from '../src/lib/checkoutCatalog.js'

/** Live Payment Links already used on blankdelay.com. Buy now opens these exact Stripe pages. */
export const STRIPE_PAYMENT_LINKS = {
  'fps-boost': 'https://buy.stripe.com/cNi8wI0QqbA6dyLb6F9bO0b',
  'controller-macro': 'https://buy.stripe.com/6oUbIU1Uu47EfGTcaJ9bO09',
  'keyboard-macro': 'https://buy.stripe.com/8x2bIU1UugUq0LZeiR9bO08',
  'zero-delay-os': 'https://buy.stripe.com/4gM4gsdDc47E2U7eiR9bO0e',
  'premium-utility': 'https://buy.stripe.com/9B628kdDc7jQdyL4Ih9bO0d',
  'aim-bundle': 'https://buy.stripe.com/8x28wI7eObA666j7Ut9bO07',
}

/** Installers already published for the original site. The new download screen opens these after payment. */
export const PRODUCT_DOWNLOADS = {
  'fps-boost': {
    url: 'https://github.com/qboubert-maker/Cursor/releases/download/blankdelay-desktop-v2/BlankDelay-Setup.exe',
    filename: 'BlankDelay-Setup.exe',
  },
  'keyboard-macro': {
    url: 'https://github.com/qboubert-maker/Cursor/releases/download/blankdelay-desktop-v2/BlankDelay-Setup.exe',
    filename: 'BlankDelay-Setup.exe',
  },
  'zero-delay-os': {
    url: 'https://github.com/qboubert-maker/Cursor/releases/download/blankdelay-desktop-v2/BlankDelay-Setup.exe',
    filename: 'BlankDelay-Setup.exe',
  },
  'premium-utility': {
    url: 'https://github.com/qboubert-maker/Cursor/releases/download/blankdelay-desktop-v2/BlankDelay-Setup.exe',
    filename: 'BlankDelay-Setup.exe',
  },
  'controller-macro': {
    url: 'https://github.com/qboubert-maker/Cursor/releases/download/blankdelay-desktop-v2/BlankDelay-Controller-Macro-V2-Setup.exe',
    filename: 'BlankDelay-Controller-Macro-V2-Setup.exe',
  },
  'aim-bundle': {
    url: 'https://github.com/qboubert-maker/Cursor/releases/download/blankdelay-desktop-v2/BlankDelay-Setup.exe',
    filename: 'BlankDelay-Setup.exe',
  },
}

const safeOrigin = (origin, host) => {
  try {
    const url = new URL(origin)
    if (!host || url.host === host) return url.origin
  } catch {
    /* use the request host */
  }
  if (host) return `https://${host}`
  return 'https://blankdelay.com'
}

const stripeClient = async () => {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) return null
  const { default: Stripe } = await import('stripe')
  return new Stripe(secret)
}

const returnUrl = (site) => `${site}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`

const linkSlug = (url) => {
  try {
    return new URL(url).pathname.replace(/^\//, '')
  } catch {
    return ''
  }
}

/** Point the existing Payment Link back at this site's download screen. The Stripe checkout page itself stays the same. */
async function ensureReturnUrl(stripe, paymentUrl, site) {
  const slug = linkSlug(paymentUrl)
  if (!slug) return
  const target = returnUrl(site)
  const listed = await stripe.paymentLinks.list({ limit: 100 })
  const link = listed.data.find((item) => (item.url || '').includes(slug))
  if (!link) return
  if (link.after_completion?.type === 'redirect' && link.after_completion?.redirect?.url === target) return
  await stripe.paymentLinks.update(link.id, {
    after_completion: { type: 'redirect', redirect: { url: target } },
  })
}

export function paymentLinkFor(productId, site) {
  const base = STRIPE_PAYMENT_LINKS[productId]
  if (!base) return null
  const url = new URL(base)
  url.searchParams.set('client_reference_id', productId)
  return url.toString()
}

export async function createCheckoutSession({ productId, origin, host }) {
  const product = CHECKOUT_PRODUCTS[productId]
  if (!product || productId === 'aim-bundle' || !STRIPE_PAYMENT_LINKS[productId]) {
    const error = new Error('Unknown product')
    error.status = 400
    throw error
  }

  const site = safeOrigin(origin, host)
  const stripe = await stripeClient()
  if (stripe) {
    try {
      await ensureReturnUrl(stripe, STRIPE_PAYMENT_LINKS[productId], site)
    } catch (error) {
      console.error('Could not set Stripe return URL:', error.message)
    }
  }

  return { url: paymentLinkFor(productId, site) }
}

function productFromSession(session) {
  const ref = String(session.client_reference_id || session.metadata?.productId || '').trim()
  if (CHECKOUT_PRODUCTS[ref]) return CHECKOUT_PRODUCTS[ref]
  const paymentLink = String(session.payment_link || '')
  const match = Object.entries(STRIPE_PAYMENT_LINKS).find(([, url]) => paymentLink && url.includes(paymentLink))
  if (match) return CHECKOUT_PRODUCTS[match[0]]
  return null
}

export async function readCheckoutSession(sessionId) {
  const stripe = await stripeClient()
  if (!stripe) {
    const error = new Error('Stripe is not configured')
    error.status = 503
    throw error
  }
  const session = await stripe.checkout.sessions.retrieve(sessionId)
  const product = productFromSession(session)
  const paid = session.payment_status === 'paid' && Boolean(product)
  return {
    paid,
    productId: paid ? product.id : '',
    productName: paid ? product.name : '',
  }
}

export async function openDownload({ sessionId, productId }) {
  const preview = sessionId === 'preview' && !process.env.STRIPE_SECRET_KEY && process.env.NODE_ENV !== 'production'
  let id = productId
  if (!preview) {
    const session = await readCheckoutSession(sessionId)
    if (!session.paid) {
      const error = new Error('Payment is not complete')
      error.status = 403
      throw error
    }
    id = session.productId
  }
  const file = PRODUCT_DOWNLOADS[id]
  if (!file) {
    const error = new Error('File is not on the server yet')
    error.status = 404
    throw error
  }
  return file
}
