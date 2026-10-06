'use strict'

const { json, readSession } = require('./_shared')

exports.handler = async (event) => {
  const sessionId = event.queryStringParameters?.session_id || ''
  if (!sessionId) return json(400, { error: 'session_id required' })
  try {
    return json(200, await readSession(sessionId))
  } catch (error) {
    return json(error.status || 500, { error: error.message || 'Could not read checkout' })
  }
}
