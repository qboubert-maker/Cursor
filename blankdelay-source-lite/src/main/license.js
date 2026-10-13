import crypto from 'node:crypto'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const PRODUCT_ID = 'controller-optimizer'
const SIGN_SECRET = 'BlankDelayPremium-sign-v1'
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const API_BASES = [
  String(process.env.BLANK_LICENSE_URL || '').trim().replace(/\/+$/, ''),
  'https://blank-bot-production.up.railway.app',
  'http://127.0.0.1:3848',
].filter(Boolean)

let hardwarePromise = null

function checksumLetters(productId, body) {
  const hash = crypto.createHmac('sha256', SIGN_SECRET).update(`${productId}:${body}`).digest()
  let out = ''
  for (let i = 0; i < 4; i += 1) out += LETTERS[hash[i] % LETTERS.length]
  return out
}

export function normalizeLicenseKey(raw) {
  const clean = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const optimizer = clean.match(/^BLANKCO([A-Z]{4})([A-Z]{4})$/)
  if (optimizer) return `BLANK-CO-${optimizer[1]}-${optimizer[2]}`
  const legacy = clean.match(/^BLANKZC([A-Z]{4})([A-Z]{4})$/)
  if (legacy) return `BLANK-ZC-${legacy[1]}-${legacy[2]}`
  return String(raw || '').toUpperCase().trim()
}

function keyKind(key) {
  const raw = normalizeLicenseKey(key)
  const own = raw.match(/^BLANK-CO-([A-Z]{4})-([A-Z]{4})$/)
  if (own) return own[2] === checksumLetters(PRODUCT_ID, own[1]) ? 'own' : 'bad'
  const legacy = raw.match(/^BLANK-ZC-([A-Z]{4})-([A-Z]{4})$/)
  if (legacy) return legacy[2] === checksumLetters('zero-delay-controller', legacy[1]) ? 'own' : 'bad'
  if (/^BLANK-[A-Z]{2,4}-[A-Z]{4}-[A-Z]{4}$/.test(raw) || /^BLANK-[A-Z]{4}-[A-Z]{4}$/.test(raw)) return 'other'
  return 'bad'
}

async function machineUuid() {
  if (process.platform !== 'win32') return ''
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-Command', '(Get-CimInstance -ClassName Win32_ComputerSystemProduct).UUID'],
      { windowsHide: true, timeout: 8000 },
    )
    return String(stdout || '').trim()
  } catch {
    return ''
  }
}

async function hardware() {
  if (!hardwarePromise) {
    hardwarePromise = (async () => {
      const uuid = await machineUuid()
      const parts = [uuid, os.hostname(), os.arch(), String(os.cpus()?.[0]?.model || '')].filter(Boolean)
      const hardwareId = crypto.createHash('sha256').update(parts.join('|')).digest('hex').toUpperCase()
      return { hardwareId, deviceLabel: os.hostname() || 'PC' }
    })()
  }
  return hardwarePromise
}

async function postLicense(pathname, body) {
  let lastError = null
  for (const base of API_BASES) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    try {
      const response = await fetch(`${base}${pathname}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      const json = await response.json().catch(() => ({}))
      return json
    } catch (error) {
      lastError = error
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError || new Error('offline')
}

function accepted(json) {
  if (!json || json.ok !== true) {
    return { ok: false, message: json?.message || json?.error || 'That key was rejected.' }
  }
  if (json.product && json.product !== PRODUCT_ID && json.product !== 'zero-delay-controller') {
    return { ok: false, message: 'This key is for a different Blank Delay product.' }
  }
  return { ok: true, key: json.key || '', message: json.message || '' }
}

async function ask(pathname, raw) {
  const key = normalizeLicenseKey(raw)
  const kind = keyKind(key)
  if (!key) return { ok: false, message: 'Enter your license key' }
  if (kind === 'other') return { ok: false, message: 'This key is for a different Blank Delay product.' }
  if (kind !== 'own') return { ok: false, message: 'Use a Controller Optimizer key from the Blank Delay Discord bot.' }
  const hw = await hardware()
  try {
    const json = await postLicense(pathname, {
      key,
      hardwareId: hw.hardwareId,
      deviceLabel: hw.deviceLabel,
      productId: PRODUCT_ID,
    })
    const result = accepted(json)
    if (result.ok) result.key = result.key || key
    return result
  } catch {
    return {
      ok: false,
      offline: true,
      message: 'Could not reach the Blank Delay license bot. Check the key and try again.',
    }
  }
}

export function redeemControllerLicense(key) {
  return ask('/api/v1/license/redeem', key)
}

export function validateControllerLicense(key) {
  return ask('/api/v1/license/validate', key)
}
