import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { app } from 'electron'

const execFileAsync = promisify(execFile)
const PRODUCT_ID = 'keyboard-optimizer'
const SIGN_SECRET = 'BlankDelayPremium-sign-v1'
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const OK_CODES = new Set(['ACTIVATED', 'ALREADY_BOUND', 'KEY_USED', 'VALID', 'OK'])

const API_BASES = [
  String(process.env.BLANK_LICENSE_URL || '').trim().replace(/\/+$/, ''),
  'https://blank-bot-production.up.railway.app',
  'http://127.0.0.1:3849',
  'http://127.0.0.1:3848',
].filter(Boolean)

let hardwarePromise = null

function sessionPath() {
  return path.join(app.getPath('userData'), 'keyboard_license.json')
}

function checksumLetters(productId, body) {
  const hash = crypto.createHmac('sha256', SIGN_SECRET).update(`${productId}:${body}`).digest()
  let out = ''
  for (let index = 0; index < 4; index += 1) out += LETTERS[hash[index] % LETTERS.length]
  return out
}

export function normalizeKey(raw) {
  const clean = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const pairs = [
    ['BLANKZD', 'BLANK-ZD'],
    ['BLANKFB', 'BLANK-FB'],
    ['BLANKDL', 'BLANK-DL'],
    ['BLANKPU', 'BLANK-PU'],
    ['BLANKCM', 'BLANK-CM'],
    ['BLANKKO', 'BLANK-KO'],
    ['BLANKKM', 'BLANK-KM'],
    ['BLANKCO', 'BLANK-CO'],
    ['BLANKPO', 'BLANK-PO'],
  ]
  for (const [prefix, dashed] of pairs) {
    if (clean.startsWith(prefix) && clean.length >= prefix.length + 8) {
      return `${dashed}-${clean.slice(prefix.length, prefix.length + 4)}-${clean.slice(prefix.length + 4, prefix.length + 8)}`
    }
  }
  if (clean.startsWith('BLANK') && clean.length >= 13) return `BLANK-${clean.slice(5, 9)}-${clean.slice(9, 13)}`
  return String(raw || '').toUpperCase().trim()
}

function verifySignedKey(key) {
  const raw = normalizeKey(key)
  const checks = [
    [/^BLANK-ZD-([A-Z]{4})-([A-Z]{4})$/, 'zero-delay'],
    [/^BLANK-FB-([A-Z]{4})-([A-Z]{4})$/, 'fps-boost'],
    [/^BLANK-DL-([A-Z]{4})-([A-Z]{4})$/, 'blank-delay'],
    [/^BLANK-PU-([A-Z]{4})-([A-Z]{4})$/, 'premium-utility'],
    [/^BLANK-CM-([A-Z]{4})-([A-Z]{4})$/, 'controller-macro'],
    [/^BLANK-KO-([A-Z]{4})-([A-Z]{4})$/, 'keyboard-optimizer'],
    [/^BLANK-KM-([A-Z]{4})-([A-Z]{4})$/, 'keyboard-macro'],
    [/^BLANK-CO-([A-Z]{4})-([A-Z]{4})$/, 'controller-optimizer'],
    [/^BLANK-PO-([A-Z]{4})-([A-Z]{4})$/, 'ping-optimizer'],
  ]
  for (const [pattern, product] of checks) {
    const match = raw.match(pattern)
    if (match) return match[2] === checksumLetters(product, match[1])
  }
  return /^BLANK-[A-Z]{4}-[A-Z]{4}$/.test(raw)
}

function serverAccepted(json) {
  if (!json || typeof json !== 'object') return false
  if (json.ok) return true
  if (OK_CODES.has(String(json.code || '').toUpperCase())) return true
  const message = String(json.message || json.error || '')
  return /already (active|used|bound)|already been used|key already/i.test(message)
}

async function cimValue(query) {
  if (process.platform !== 'win32') return ''
  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', query], {
      windowsHide: true,
      timeout: 8000,
    })
    return String(stdout || '').trim()
  } catch {
    return ''
  }
}

async function hardware() {
  if (!hardwarePromise) {
    hardwarePromise = (async () => {
      const parts = [
        await cimValue('(Get-CimInstance Win32_ComputerSystemProduct).UUID'),
        await cimValue('(Get-CimInstance Win32_DiskDrive | Select-Object -First 1).SerialNumber'),
        await cimValue('(Get-CimInstance Win32_BaseBoard).SerialNumber'),
        os.hostname(),
        os.arch(),
        String(os.cpus()?.[0]?.model || ''),
      ].filter((part) => part && !/^SerialNumber$/i.test(part))
      const hardwareId = crypto.createHash('sha256').update(parts.join('|')).digest('hex').toUpperCase()
      const clean = hardwareId.slice(0, 12)
      return {
        hardwareId,
        deviceId: `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`,
        deviceLabel: os.hostname() || 'PC',
      }
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
      return await response.json().catch(() => ({}))
    } catch (error) {
      lastError = error
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError || new Error('offline')
}

function keyKind(key) {
  const raw = normalizeKey(key)
  const own = raw.match(/^BLANK-KO-([A-Z]{4})-([A-Z]{4})$/)
  if (own) return own[2] === checksumLetters(PRODUCT_ID, own[1]) ? 'own' : 'bad'
  if (/^BLANK-[A-Z]{2,4}-[A-Z]{4}-[A-Z]{4}$/.test(raw) || /^BLANK-[A-Z]{4}-[A-Z]{4}$/.test(raw)) return 'other'
  return 'bad'
}

async function verifyKey(raw, mode) {
  const key = normalizeKey(raw)
  const kind = keyKind(key)
  if (!key) return { ok: false, message: 'Enter a license key.' }
  if (kind === 'other') return { ok: false, message: 'This key is for a different Blank Delay product.' }
  if (kind !== 'own') return { ok: false, message: 'Use a Keyboard Optimizer key from the Blank Delay Discord bot.' }
  const hw = await hardware()
  const pathname = mode === 'validate' ? '/api/v1/license/validate' : '/api/v1/license/redeem'
  try {
    const json = await postLicense(pathname, {
      key,
      hardwareId: hw.hardwareId,
      deviceLabel: hw.deviceLabel,
      productId: PRODUCT_ID,
    })
    if (serverAccepted(json)) return { ok: true, key }
    if (verifySignedKey(key)) return { ok: true, key, offline: true }
    return { ok: false, message: json?.message || json?.error || 'That key was rejected.' }
  } catch {
    if (verifySignedKey(key)) return { ok: true, key, offline: true }
    return { ok: false, message: 'Could not reach the Blank license bot.' }
  }
}

export function readSavedKey() {
  try {
    const saved = JSON.parse(fs.readFileSync(sessionPath(), 'utf8'))
    return normalizeKey(saved?.key || '')
  } catch {
    return ''
  }
}

function writeSavedKey(key) {
  fs.mkdirSync(path.dirname(sessionPath()), { recursive: true })
  fs.writeFileSync(sessionPath(), JSON.stringify({ key }))
}

export async function redeemKeyboardLicense(raw) {
  const result = await verifyKey(raw, 'redeem')
  if (result.ok) writeSavedKey(result.key)
  return result
}

export async function validateKeyboardLicense(raw) {
  const result = await verifyKey(raw, 'validate')
  if (result.ok) writeSavedKey(result.key)
  return result
}

export async function keyboardHardware() {
  const hw = await hardware()
  return { deviceId: hw.deviceId }
}
