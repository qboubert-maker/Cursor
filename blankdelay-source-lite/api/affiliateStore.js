import { randomBytes, scrypt, timingSafeEqual, createHash, createHmac } from 'node:crypto'
import { promisify } from 'node:util'
import { atomically, loadData, loadOrCreateSecret, saveData } from './affiliateBackend.js'
import { cleanLinkName } from './linkLanguage.js'

const scryptAsync = promisify(scrypt)
const COMMISSION_RATE = 0.1
const CLICK_WINDOW_MS = 24 * 60 * 60 * 1000
const SESSION_MS = 14 * 24 * 60 * 60 * 1000
const RESERVED = new Set([
  'admin', 'api', 'app', 'affiliate', 'affiliates', 'assets', 'blank', 'blankdelay', 'checkout',
  'commercial', 'console', 'controller', 'dashboard', 'demos', 'download', 'favicon', 'index',
  'exclusive', 'login', 'optimizer', 'policy', 'products', 'public', 'ref', 'robots', 'signup', 'store',
  'tweaks', 'www',
])

const empty = () => ({ users: [], links: [], guards: [], clicks: [], sales: [], payouts: [], bannedEmails: [], admin: null })

let queue = Promise.resolve()
let secretCache = ''

const fail = (status, message) => {
  const error = new Error(message)
  error.status = status
  throw error
}

const withStore = (fn) => {
  const step = () => atomically(fn)
  const run = queue.then(step, step)
  queue = run.then(() => {}, () => {})
  return run
}

const readStore = async () => ({ ...empty(), ...((await loadData()) || {}) })

const writeStore = (data) => saveData(data)

export const sessionSecret = async () => {
  if (process.env.AFFILIATE_SESSION_SECRET) return process.env.AFFILIATE_SESSION_SECRET
  if (secretCache) return secretCache
  secretCache = await loadOrCreateSecret()
  return secretCache
}

const b64url = (value) => Buffer.from(value).toString('base64url')

export const signSession = async (userId, role = 'affiliate', ttlMs = SESSION_MS) => {
  const body = b64url(JSON.stringify({ sub: userId, role, exp: Date.now() + ttlMs }))
  const sig = createHmac('sha256', await sessionSecret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export const readSession = async (token) => {
  if (!token || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  const expected = createHmac('sha256', await sessionSecret()).update(body).digest('base64url')
  const left = Buffer.from(sig)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!payload?.sub || payload.exp < Date.now()) return null
    const role = payload.role === 'admin' ? 'admin' : 'affiliate'
    return { id: payload.sub, role }
  } catch {
    return null
  }
}

const hashPassword = async (password, salt = randomBytes(16).toString('hex')) => {
  const key = await scryptAsync(password, salt, 32)
  return { salt, hash: Buffer.from(key).toString('hex') }
}

const passwordMatches = async (password, salt, hash) => {
  const key = await scryptAsync(password, salt, 32)
  const left = Buffer.from(key)
  const right = Buffer.from(hash, 'hex')
  return left.length === right.length && timingSafeEqual(left, right)
}

export const normalizeSlug = (value) => String(value || '').trim().toLowerCase()

export const validSlug = (slug) => /^[a-z0-9](?:[a-z0-9-]{1,22}[a-z0-9])$/.test(slug) && !RESERVED.has(slug)

const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 120

const ADMIN_KEY_PRODUCT = 'affiliate-admin'
const ADMIN_KEY_SECRET = 'BlankDelayPremium-sign-v1'
const KEY_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LICENSE_BASES = [
  String(process.env.BLANK_LICENSE_URL || '').trim().replace(/\/+$/, ''),
  'https://blank-bot-production.up.railway.app',
].filter(Boolean)

const adminKeyChecksum = (body) => {
  const hash = createHmac('sha256', ADMIN_KEY_SECRET).update(`${ADMIN_KEY_PRODUCT}:${body}`).digest()
  let out = ''
  for (let index = 0; index < 4; index += 1) out += KEY_LETTERS[hash[index] % KEY_LETTERS.length]
  return out
}

export const normalizeAdminKey = (raw) => {
  const clean = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const match = clean.match(/^BLANKAA([A-Z]{4})([A-Z]{4})$/)
  if (!match) return ''
  return `BLANK-AA-${match[1]}-${match[2]}`
}

export const validAdminKey = (raw) => {
  const clean = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const match = clean.match(/^BLANKAA([A-Z]{4})([A-Z]{4})$/)
  return Boolean(match && match[2] === adminKeyChecksum(match[1]))
}

const bannedList = (data) => (Array.isArray(data.bannedEmails) ? data.bannedEmails : [])

const bannedRecord = (data, email) => bannedList(data).find((item) => item.email === email)

const failBanned = () => {
  const error = new Error("You have been banned for violating the terms of service of our company's policy.")
  error.status = 403
  error.code = 'banned'
  throw error
}

const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  createdAt: user.createdAt,
})

const money = (cents) => Math.max(0, Math.round(Number(cents) || 0))

export async function adminExists() {
  const data = await readStore()
  return Boolean(data.admin?.email)
}

export async function adminProfile() {
  const data = await readStore()
  if (!data.admin?.email) return null
  return { id: 'admin', email: data.admin.email, name: 'Program Admin', role: 'admin' }
}

export async function createAdmin({ email, password }) {
  const cleanEmail = String(email || '').trim().toLowerCase()
  if (!validEmail(cleanEmail)) fail(400, 'Enter a valid email.')
  if (typeof password !== 'string' || password.length < 8 || password.length > 200) fail(400, 'Use a password of at least 8 characters.')
  return withStore(async () => {
    const data = await readStore()
    if (data.admin?.email) fail(409, 'The program login already exists.')
    if (data.users.some((user) => user.email === cleanEmail)) fail(409, 'That email already belongs to an affiliate.')
    const { salt, hash } = await hashPassword(password)
    data.admin = {
      email: cleanEmail,
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
    }
    await writeStore(data)
    return { id: 'admin', email: cleanEmail, name: 'Program Admin', role: 'admin' }
  })
}

export async function loginAdmin({ email, password }) {
  const cleanEmail = String(email || '').trim().toLowerCase()
  const data = await readStore()
  if (!data.admin?.email || data.admin.email !== cleanEmail) return null
  const matches = await passwordMatches(String(password || ''), data.admin.passwordSalt, data.admin.passwordHash)
  if (!matches) fail(401, 'Email or password is incorrect.')
  return { id: 'admin', email: data.admin.email, name: 'Program Admin', role: 'admin' }
}

export async function loginWithAdminKey(raw) {
  const key = normalizeAdminKey(raw)
  if (!validAdminKey(key)) fail(401, 'Use an Affiliate Admin key (BLANK-AA-XXXX-XXXX) from the Blank Delay Discord bot.')
  let sawBot = false
  for (const base of LICENSE_BASES) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    try {
      const response = await fetch(`${base}/api/licenses/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ license_key: key }),
        signal: controller.signal,
      })
      const json = await response.json().catch(() => ({}))
      sawBot = true
      if (!json.success) fail(401, json.error || 'That key was rejected.')
      if (json.product !== ADMIN_KEY_PRODUCT) fail(401, 'This key is for a different Blank Delay product.')
      return { id: 'admin', email: 'Program Admin', name: 'Program Admin', role: 'admin' }
    } catch (error) {
      if (error.status) throw error
    } finally {
      clearTimeout(timer)
    }
  }
  if (!sawBot) fail(503, 'Could not reach the Blank license bot.')
  fail(401, 'That key was rejected.')
}

const rosterFrom = (data) => {
  const banned = new Set(bannedList(data).map((item) => item.email))
  const people = data.users.map((user) => {
    const link = data.links.find((item) => item.userId === user.id)
    const sales = data.sales.filter((sale) => sale.userId === user.id)
    const isBanned = banned.has(user.email)
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      slug: isBanned ? '' : link?.slug || '',
      clicks: isBanned ? 0 : link?.clickCount || 0,
      conversions: sales.length,
      totalEarningsCents: sales.reduce((sum, sale) => sum + sale.commissionCents, 0),
      createdAt: user.createdAt,
      banned: isBanned,
    }
  })
  for (const ban of bannedList(data)) {
    if (data.users.some((user) => user.email === ban.email)) continue
    people.push({
      id: `banned:${ban.email}`,
      name: ban.name || '—',
      email: ban.email,
      slug: '',
      clicks: 0,
      conversions: 0,
      totalEarningsCents: 0,
      createdAt: ban.bannedAt,
      banned: true,
    })
  }
  people.sort((a, b) => Number(a.banned) - Number(b.banned) || b.totalEarningsCents - a.totalEarningsCents || a.name.localeCompare(b.name))
  const active = people.filter((person) => !person.banned)
  return {
    people,
    affiliates: active.length,
    totalEarningsCents: people.reduce((sum, person) => sum + person.totalEarningsCents, 0),
    conversions: people.reduce((sum, person) => sum + person.conversions, 0),
  }
}

export async function programRoster() {
  return rosterFrom(await readStore())
}

export async function banAffiliate(email) {
  const cleanEmail = String(email || '').trim().toLowerCase()
  if (!validEmail(cleanEmail)) fail(400, 'Enter a valid email.')
  return withStore(async () => {
    const data = await readStore()
    if (!Array.isArray(data.bannedEmails)) data.bannedEmails = []
    if (data.bannedEmails.some((item) => item.email === cleanEmail)) fail(409, 'That email is already banned.')
    const user = data.users.find((item) => item.email === cleanEmail)
    if (!user) fail(404, 'No affiliate uses that email.')
    const link = data.links.find((item) => item.userId === user.id)
    const linkIds = new Set(data.links.filter((item) => item.userId === user.id).map((item) => item.id))
    data.links = data.links.filter((item) => item.userId !== user.id)
    data.guards = data.guards.filter((guard) => !linkIds.has(guard.linkId))
    data.clicks = data.clicks.filter((click) => !linkIds.has(click.linkId))
    data.bannedEmails.push({
      email: cleanEmail,
      name: user.name,
      userId: user.id,
      slug: link?.slug || '',
      bannedAt: new Date().toISOString(),
    })
    await writeStore(data)
    return { email: cleanEmail, name: user.name, ...rosterFrom(data) }
  })
}

export async function unbanAffiliate(email) {
  const cleanEmail = String(email || '').trim().toLowerCase()
  if (!validEmail(cleanEmail)) fail(400, 'Enter a valid email.')
  return withStore(async () => {
    const data = await readStore()
    const bans = bannedList(data)
    if (!bans.some((item) => item.email === cleanEmail)) fail(404, 'That email is not banned.')
    data.bannedEmails = bans.filter((item) => item.email !== cleanEmail)
    await writeStore(data)
    return rosterFrom(data)
  })
}

export async function resetEarnings(userId) {
  const target = String(userId || '')
  return withStore(async () => {
    const data = await readStore()
    const targetUser = target ? data.users.find((user) => user.id === target) : null
    if (target && !targetUser) fail(404, 'That affiliate was not found.')
    for (const sale of data.sales) {
      if (!target || sale.userId === target) sale.commissionCents = 0
    }
    await writeStore(data)
    return programRoster()
  })
}

export async function signup({ email, password, name }) {
  const cleanEmail = String(email || '').trim().toLowerCase()
  const cleanName = String(name || '').trim()
  if (!validEmail(cleanEmail)) fail(400, 'Enter a valid email.')
  if (cleanName.length < 2 || cleanName.length > 40) fail(400, 'Enter your name.')
  if (typeof password !== 'string' || password.length < 8 || password.length > 200) fail(400, 'Use a password of at least 8 characters.')
  return withStore(async () => {
    const data = await readStore()
    if (bannedRecord(data, cleanEmail)) failBanned()
    if (data.admin?.email === cleanEmail || data.users.some((user) => user.email === cleanEmail)) {
      fail(409, 'An account with that email already exists.')
    }
    const { salt, hash } = await hashPassword(password)
    const user = {
      id: randomBytes(16).toString('hex'),
      email: cleanEmail,
      name: cleanName,
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
    }
    data.users.push(user)
    await writeStore(data)
    return publicUser(user)
  })
}

export async function login({ email, password }) {
  const cleanEmail = String(email || '').trim().toLowerCase()
  return withStore(async () => {
    const data = await readStore()
    if (bannedRecord(data, cleanEmail)) failBanned()
    const user = data.users.find((item) => item.email === cleanEmail)
    const matches = user ? await passwordMatches(String(password || ''), user.passwordSalt, user.passwordHash) : false
    if (!matches) fail(401, 'Email or password is incorrect.')
    return publicUser(user)
  })
}

export async function userById(id) {
  const data = await readStore()
  const user = data.users.find((item) => item.id === id)
  if (!user) return null
  if (bannedRecord(data, user.email)) return { banned: true, email: user.email }
  return publicUser(user)
}

export async function saveLink(userId, slugInput) {
  const slug = normalizeSlug(slugInput)
  if (!validSlug(slug)) fail(400, 'Use 3 to 24 letters, numbers, or hyphens.')
  if (!cleanLinkName(slug)) fail(400, 'Choose a clean link name. Keep it PG.')
  return withStore(async () => {
    const data = await readStore()
    const owner = data.users.find((user) => user.id === userId)
    if (!owner) fail(404, 'That account was not found.')
    if (bannedRecord(data, owner.email)) failBanned()
    const taken = data.links.find((link) => link.slug === slug && link.userId !== userId)
    if (taken) fail(409, 'That link name is already taken.')
    let link = data.links.find((item) => item.userId === userId)
    if (!link) {
      link = { id: randomBytes(16).toString('hex'), userId, slug, clickCount: 0, createdAt: new Date().toISOString() }
      data.links.push(link)
    } else {
      link.slug = slug
    }
    await writeStore(data)
    return { slug: link.slug, clickCount: link.clickCount }
  })
}

const fingerprint = (ip, pepper) => createHash('sha256').update(`${pepper}:${ip}`).digest('hex')

const deviceOf = (userAgent) => {
  const agent = String(userAgent || '')
  if (/ipad|tablet|playbook|silk/i.test(agent)) return 'Tablet'
  if (/mobi|iphone|ipod|android|phone/i.test(agent)) return 'Phone'
  return 'Computer'
}

export async function trackClick({ slug, ip, visitorId, userAgent }) {
  const cleanSlug = normalizeSlug(slug)
  if (!validSlug(cleanSlug)) return { ok: false }
  const pepper = await sessionSecret()
  return withStore(async () => {
    const data = await readStore()
    const link = data.links.find((item) => item.slug === cleanSlug)
    const owner = link ? data.users.find((user) => user.id === link.userId) : null
    if (!link || (owner && bannedRecord(data, owner.email))) return { ok: false }
    const now = Date.now()
    data.guards = data.guards.filter((guard) => now - Date.parse(guard.createdAt) < CLICK_WINDOW_MS)
    const visitor = String(visitorId || '')
    const device = deviceOf(userAgent)
    const duplicate = Boolean(visitor) && data.guards.some((guard) => guard.linkId === link.id && guard.visitorId === visitor)
    if (!duplicate) {
      link.clickCount += 1
      data.guards.push({
        id: randomBytes(12).toString('hex'),
        linkId: link.id,
        ipHash: fingerprint(ip || 'unknown', pepper),
        visitorId: visitor,
        device,
        createdAt: new Date(now).toISOString(),
      })
      data.clicks.unshift({ id: randomBytes(12).toString('hex'), linkId: link.id, device, createdAt: new Date(now).toISOString() })
      data.clicks = data.clicks.filter((click) => data.links.some((item) => item.id === click.linkId)).slice(0, 400)
    }
    await writeStore(data)
    return { ok: true, counted: !duplicate, slug: link.slug, clicks: link.clickCount }
  })
}

export async function creditSale({ orderId, slug, totalCents, productId }) {
  const cleanSlug = normalizeSlug(slug)
  const total = money(totalCents)
  if (!orderId || !cleanSlug || total <= 0) return null
  return withStore(async () => {
    const data = await readStore()
    if (data.sales.some((sale) => sale.orderId === orderId)) return data.sales.find((sale) => sale.orderId === orderId)
    const link = data.links.find((item) => item.slug === cleanSlug)
    const owner = link ? data.users.find((user) => user.id === link.userId) : null
    if (!link || (owner && bannedRecord(data, owner.email))) return null
    const sale = {
      id: randomBytes(16).toString('hex'),
      orderId: String(orderId),
      userId: link.userId,
      linkId: link.id,
      productId: String(productId || ''),
      totalCents: total,
      commissionCents: Math.round(total * COMMISSION_RATE),
      createdAt: new Date().toISOString(),
    }
    data.sales.unshift(sale)
    await writeStore(data)
    return sale
  })
}

const balanceOf = (data, userId) => {
  const earned = data.sales.filter((sale) => sale.userId === userId).reduce((sum, sale) => sum + sale.commissionCents, 0)
  const reserved = data.payouts.filter((payout) => payout.userId === userId).reduce((sum, payout) => sum + payout.amountCents, 0)
  return { earned, reserved, available: Math.max(0, earned - reserved) }
}

export async function requestPayout(userId, amountCents) {
  const amount = money(amountCents)
  if (amount < 1000) fail(400, 'The minimum payout is $10.00.')
  return withStore(async () => {
    const data = await readStore()
    const { available } = balanceOf(data, userId)
    if (amount > available) fail(400, 'That amount is above your available balance.')
    const payout = {
      id: randomBytes(16).toString('hex'),
      userId,
      amountCents: amount,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    data.payouts.unshift(payout)
    await writeStore(data)
    return payout
  })
}

export async function statsFor(userId) {
  const data = await readStore()
  const link = data.links.find((item) => item.userId === userId) || null
  const { earned, available } = balanceOf(data, userId)
  const sales = data.sales.filter((sale) => sale.userId === userId).slice(0, 25)
  const clicks = link ? data.clicks.filter((click) => click.linkId === link.id).slice(0, 25) : []
  const payouts = data.payouts.filter((payout) => payout.userId === userId).slice(0, 25)
  return {
    slug: link?.slug || '',
    rate: COMMISSION_RATE,
    totalEarningsCents: earned,
    availableBalanceCents: available,
    clicks: link?.clickCount || 0,
    conversions: data.sales.filter((sale) => sale.userId === userId).length,
    sales,
    clicksLog: clicks,
    payouts,
  }
}
