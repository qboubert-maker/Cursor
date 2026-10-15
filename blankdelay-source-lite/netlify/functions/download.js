'use strict'

const { DOWNLOADS, json, readSession } = require('./_shared')

exports.handler = async (event) => {
  const sessionId = event.queryStringParameters?.session_id || ''
  if (!sessionId) return json(400, { error: 'session_id required' })
  try {
    const session = await readSession(sessionId)
    if (!session.paid) return json(403, { error: 'Payment is not complete' })
    const url = DOWNLOADS[session.productId]
    if (!url) return json(404, { error: 'File is not on the server yet' })
    return json(200, { url, filename: url.split('/').pop() })
  } catch (error) {
    return json(error.status || 500, { error: error.message || 'The download could not start.' })
  }
}
