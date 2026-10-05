'use strict'

const { PRODUCTS, json, paymentLinkFor } = require('./_shared')

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
  try {
    return json(200, { url: paymentLinkFor(productId) })
  } catch (error) {
    return json(error.status || 500, { error: error.message || 'Stripe could not be opened.' })
  }
}
