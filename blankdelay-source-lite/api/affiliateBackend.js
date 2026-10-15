import { AsyncLocalStorage } from 'node:async_hooks'
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const DATA_PATH = resolve(process.env.AFFILIATE_DATA_PATH || resolve(process.cwd(), 'data', 'affiliates.json'))
const SECRET_PATH = resolve(dirname(DATA_PATH), 'session-secret')
const STORE_NAME = 'blank-delay-affiliates'
const DATA_KEY = 'affiliates'
const SECRET_KEY = 'session-secret'
const MAX_ATTEMPTS = 6

// Netlify functions have no lasting disk, so there the data lives in Netlify Blobs.
const onNetlify = () => Boolean(globalThis.Netlify || process.env.NETLIFY_BLOBS_CONTEXT)

class StoreConflict extends Error {}

const transaction = new AsyncLocalStorage()

let blobs = null
const blobStore = async () => {
  if (!blobs) {
    const { getStore } = await import('@netlify/blobs')
    blobs = getStore({ name: STORE_NAME, consistency: 'strong' })
  }
  return blobs
}

export async function loadData() {
  if (!onNetlify()) {
    try {
      return JSON.parse(await readFile(DATA_PATH, 'utf8'))
    } catch (error) {
      if (error.code === 'ENOENT') return null
      throw error
    }
  }
  const store = await blobStore()
  const entry = await store.getWithMetadata(DATA_KEY, { type: 'json' })
  const state = transaction.getStore()
  // The local Blobs sandbox returns no ETag on reads; without one the write below is unconditional.
  if (state && (!entry || entry.etag)) {
    state.read = true
    state.etag = entry?.etag || ''
  }
  return entry?.data ?? null
}

export async function saveData(data) {
  if (!onNetlify()) {
    await mkdir(dirname(DATA_PATH), { recursive: true })
    await writeFile(DATA_PATH, JSON.stringify(data), 'utf8')
    return
  }
  const store = await blobStore()
  const state = transaction.getStore()
  if (!state?.read) {
    await store.setJSON(DATA_KEY, data)
    return
  }
  // Another function instance may have written since this one read; if so, the whole change is redone.
  const result = await store.setJSON(DATA_KEY, data, state.etag ? { onlyIfMatch: state.etag } : { onlyIfNew: true })
  if (!result.modified) throw new StoreConflict()
  state.etag = result.etag || ''
}

export async function atomically(fn) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await transaction.run({ read: false, etag: '' }, fn)
    } catch (error) {
      if (!(error instanceof StoreConflict)) throw error
      if (attempt >= MAX_ATTEMPTS) {
        const busy = new Error('The affiliate program is busy. Try again.')
        busy.status = 503
        throw busy
      }
      await new Promise((done) => setTimeout(done, 40 * attempt + Math.random() * 60))
    }
  }
}

export async function loadOrCreateSecret() {
  if (!onNetlify()) {
    try {
      const saved = (await readFile(SECRET_PATH, 'utf8')).trim()
      if (saved) return saved
    } catch {
      /* create one below */
    }
    const secret = randomBytes(32).toString('hex')
    await mkdir(dirname(SECRET_PATH), { recursive: true })
    await writeFile(SECRET_PATH, secret, { encoding: 'utf8', mode: 0o600 })
    return secret
  }
  const store = await blobStore()
  const saved = await store.get(SECRET_KEY, { type: 'text' })
  if (saved) return saved
  const secret = randomBytes(32).toString('hex')
  const result = await store.set(SECRET_KEY, secret, { onlyIfNew: true })
  if (result.modified) return secret
  return store.get(SECRET_KEY, { type: 'text' })
}
