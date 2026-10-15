import shared from './_shared.js'
import { creditPaidCheckout } from '../../api/affiliateHttp.js'

export default async (request) => {
  const sessionId = new URL(request.url).searchParams.get('session_id') || ''
  if (!sessionId) return Response.json({ error: 'session_id required' }, { status: 400 })
  try {
    const { session, ...result } = await shared.readSession(sessionId, { withSession: true })
    if (result.paid) {
      await creditPaidCheckout(session).catch((error) => console.error('Affiliate commission was not recorded', error))
    }
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return Response.json({ error: error.message || 'Could not read checkout' }, { status: error.status || 500 })
  }
}

export const config = { path: '/api/checkout-session' }
