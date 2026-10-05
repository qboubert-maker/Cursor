import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { createCheckoutSession, openDownload, readCheckoutSession } from './api/checkout.js'

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function sendError(res, error) {
  res.statusCode = error.status || 500
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ error: error.message || 'Request failed' }))
}

function paymentApi() {
  const handle = async (req, res, next) => {
    const [url, query = ''] = (req.url || '').split('?')
    const params = new URLSearchParams(query)
    try {
      if (url === '/api/create-checkout-session') {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }
        const body = await readJson(req)
        const result = await createCheckoutSession({ ...body, host: req.headers.host })
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(result))
        return
      }
      if (url === '/api/checkout-session') {
        const result = await readCheckoutSession(params.get('session_id') || '')
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(result))
        return
      }
      if (url === '/api/download') {
        const file = await openDownload({ sessionId: params.get('session_id') || '', productId: params.get('product') || '' })
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ url: file.url, filename: file.filename }))
        return
      }
    } catch (error) {
      if (url === '/api/create-checkout-session' || url === '/api/checkout-session' || url === '/api/download') {
        sendError(res, error)
        return
      }
    }
    next()
  }

  return {
    name: 'blank-delay-payment-api',
    configureServer(server) {
      server.middlewares.use(handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (env.STRIPE_SECRET_KEY) process.env.STRIPE_SECRET_KEY = env.STRIPE_SECRET_KEY

  return {
    plugins: [react(), tailwindcss(), paymentApi()],
  }
})
