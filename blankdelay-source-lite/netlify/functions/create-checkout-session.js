'use strict'

const { PRODUCTS, json, siteOrigin, createSession } = require('./_shared')

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
    const url = await createSession(productId, site)
    return json(200, { url })
  } catch (error) {
    return json(error.status || 500, { error: error.message || 'Stripe could not be opened.' })
  }
}
