import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { createCheckoutSession, openDownload, readCheckoutSession } from './api/checkout.js'
import { handleAffiliateRequest, referralFrom } from './api/affiliateHttp.js'

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

function consolePage() {
  const rewrite = (req, _res, next) => {
    const url = (req.url || '').split('?')[0]
    if (url === '/console' || url === '/console/') req.url = '/console.html'
    if (url === '/commercial' || url === '/commercial/') req.url = '/commercial.html'
    if (url === '/controller' || url === '/controller/') req.url = '/controller.html'
    if (url === '/optimizer' || url === '/optimizer/') req.url = '/optimizer.html'
    if (url === '/affiliates' || url.startsWith('/affiliates/')) req.url = '/index.html'
    next()
  }
  return {
    name: 'blank-delay-console-page',
    configureServer(server) {
      server.middlewares.use(rewrite)
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite)
    },
  }
}

function paymentApi() {
  const handle = async (req, res, next) => {
    const [url, query = ''] = (req.url || '').split('?')
    const params = new URLSearchParams(query)
    try {
      if (await handleAffiliateRequest(req, res)) return
      if (url === '/api/create-checkout-session') {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }
        const body = await readJson(req)
        const result = await createCheckoutSession({ ...body, host: req.headers.host, referral: referralFrom(req) })
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
      if (url.startsWith('/api/') || url.startsWith('/ref/')) {
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
  for (const key of [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'AFFILIATE_SESSION_SECRET',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_FROM',
  ]) {
    if (env[key]) process.env[key] = env[key]
  }

  return {
    plugins: [react(), tailwindcss(), consolePage(), paymentApi()],
    server: {
      watch: {
        ignored: ['**/config/**', '**/data/**'],
      },
    },
    worker: { format: 'es' },
    build: {
      rolldownOptions: {
        input: {
          main: fileURLToPath(new URL('./index.html', import.meta.url)),
          console: fileURLToPath(new URL('./console.html', import.meta.url)),
          commercial: fileURLToPath(new URL('./commercial.html', import.meta.url)),
          controller: fileURLToPath(new URL('./controller.html', import.meta.url)),
          optimizer: fileURLToPath(new URL('./optimizer.html', import.meta.url)),
        },
      },
    },
  }
})
