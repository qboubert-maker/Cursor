import { CHECKOUT_PRODUCTS } from '../src/lib/checkoutCatalog.js'

/** Live Payment Links already used on blankdelay.com. Buy now opens these exact Stripe pages. */
export const STRIPE_PAYMENT_LINKS = {
  'fps-boost': 'https://buy.stripe.com/28E6oAar05bIcuHdeN9bO0k',
  'controller-macro': 'https://buy.stripe.com/dRm8wIeHgdIe2U7eiR9bO0j',
  'keyboard-macro': 'https://buy.stripe.com/cNi3cobv4gUqcuHeiR9bO0i',
  'zero-delay-os': 'https://buy.stripe.com/6oU5kw56GeMigKXfmV9bO0h',
  'premium-utility': 'https://buy.stripe.com/fZu3co8iSaw2eCP1w59bO0g',
  'controller-optimizer': 'https://buy.stripe.com/14A14g6aKbA62U73Ed9bO0n',
  'keyboard-optimizer': 'https://buy.stripe.com/dRm00c2Yy9rY66jeiR9bO0o',
  'blank-optimizer': 'https://buy.stripe.com/bJeeV6bv49rY66j1w59bO0m',
}

/** Installers already published for the original site. The new download screen opens these after payment. */
export const PRODUCT_DOWNLOADS = {
  'fps-boost': {
    url: 'https://github.com/qboubert-maker/Cursor/releases/download/blankdelay-desktop-v2/Blank-Fps-Boost.exe',
    filename: 'Blank Fps Boost.exe',
  },
  'keyboard-macro': {
    url: 'https://github.com/qboubert-maker/Cursor/releases/download/blankdelay-desktop-v2/Blank-Keyboard-Macro.exe',
    filename: 'Blank Keyboard Macro.exe',
  },
  'zero-delay-os': {
    url: 'https://github.com/qboubert-maker/Cursor/releases/download/blankdelay-desktop-v2/Blank-Zero-Delay.exe',
    filename: 'Blank Zero Delay.exe',
  },
  'premium-utility': {
    url: 'https://github.com/qboubert-maker/Cursor/releases/download/blankdelay-desktop-v2/Blank-Delay-Premium.exe',
    filename: 'Blank Delay Premium.exe',
  },
  'controller-macro': {
    url: 'https://github.com/qboubert-maker/Cursor/releases/download/blankdelay-desktop-v2/Blank-Delay-Controller-Macro.exe',
    filename: 'Blank Delay Controller Macro.exe',
  },
  'controller-optimizer': {
    url: 'https://github.com/qboubert-maker/Cursor/releases/download/blankdelay-desktop-v2/Blank-Delay-Controller-Optimizer.exe',
    filename: 'Blank Delay Controller Optimizer.exe',
  },
  'keyboard-optimizer': {
    url: 'https://github.com/qboubert-maker/Cursor/releases/download/blankdelay-desktop-v2/Blank-Delay-Keyboard-Optimizer.exe',
    filename: 'Blank Delay Keyboard Optimizer.exe',
  },
  'blank-optimizer': {
    url: 'https://github.com/qboubert-maker/Cursor/releases/download/blankdelay-desktop-v2/The-Blank-Optimizer.exe',
    filename: 'The Blank Optimizer.exe',
  },
}

const stripeClient = async () => {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) return null
  const { default: Stripe } = await import('stripe')
  return new Stripe(secret)
}

export function paymentLinkFor(productId) {
  const base = STRIPE_PAYMENT_LINKS[productId]
  if (!base) return null
  const url = new URL(base)
  url.searchParams.set('client_reference_id', productId)
  return url.toString()
}

export async function createCheckoutSession({ productId }) {
  const product = CHECKOUT_PRODUCTS[productId]
  if (!product || productId === 'aim-bundle') {
    const error = new Error('Unknown product')
    error.status = 400
    throw error
  }
  const url = paymentLinkFor(product.id)
  if (!url) {
    const error = new Error(`Checkout for ${product.name} opens soon. Join Discord to get it now.`)
    error.status = 503
    throw error
  }
  return { url }
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
