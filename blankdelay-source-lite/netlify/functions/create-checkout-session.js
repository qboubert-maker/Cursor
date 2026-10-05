'use strict'

const { PRODUCTS, json, siteOrigin, ensureReturnUrl, paymentUrl } = require('./_shared')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })
  let body = {}
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }
  const productId = String(body.productId || '')
  if (!PRODUCTS[productId] || productId === 'aim-bundle') return json(400, { error: 'Unknown product' })
  const host = event.headers.host || event.headers.Host || ''
  const site = siteOrigin(body.origin, host)
  try {
    const base = paymentUrl(productId).split('?')[0]
    await ensureReturnUrl(base, site)
  } catch (error) {
    console.error('return url', error.message)
  }
  return json(200, { url: paymentUrl(productId) })
}
