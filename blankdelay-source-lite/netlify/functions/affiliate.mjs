import { Readable } from 'node:stream'
import { handleAffiliateRequest } from '../../api/affiliateHttp.js'

// Runs the same request handler the Vite dev server uses, through a small Node req/res shim.
export default async (request, context) => {
  const url = new URL(request.url)
  const body = request.method === 'GET' || request.method === 'HEAD' ? Buffer.alloc(0) : Buffer.from(await request.arrayBuffer())
  const headers = Object.fromEntries(request.headers)
  headers['x-forwarded-proto'] ||= url.protocol.replace(':', '')
  if (context?.ip) headers['x-forwarded-for'] = context.ip
  headers.host ||= url.host

  const req = Readable.from(body.length ? [body] : [])
  Object.assign(req, { method: request.method, url: `${url.pathname}${url.search}`, headers, socket: { remoteAddress: context?.ip || '' } })

  const responseHeaders = new Headers()
  let responseBody = null
  const res = {
    statusCode: 200,
    setHeader(name, value) {
      responseHeaders.delete(name)
      for (const item of Array.isArray(value) ? value : [value]) responseHeaders.append(name, String(item))
    },
    end(chunk) {
      if (chunk != null) responseBody = chunk
    },
  }

  const handled = await handleAffiliateRequest(req, res)
  if (!handled) return Response.json({ error: 'Not found' }, { status: 404 })
  return new Response(request.method === 'HEAD' ? null : responseBody, { status: res.statusCode, headers: responseHeaders })
}

export const config = { path: ['/api/affiliate/*', '/api/stripe/webhook', '/ref/*'] }
