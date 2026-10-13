import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { app } from 'electron'

const execFileAsync = promisify(execFile)
const PRODUCT_ID = 'blank-optimizer'
const SIGN_SECRET = 'BlankDelayPremium-sign-v1'
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const OK_CODES = new Set(['ACTIVATED', 'ALREADY_BOUND', 'KEY_USED', 'VALID', 'OK'])

const API_BASES = [
  String(process.env.BLANK_LICENSE_URL || '').trim().replace(/\/+$/, ''),
  'https://blank-bot-production.up.railway.app',
].filter(Boolean)

let hardwarePromise = null

function sessionPath() {
  return path.join(app.getPath('userData'), 'optimizer_license.json')
}

function checksumLetters(body) {
  const hash = crypto.createHmac('sha256', SIGN_SECRET).update(`${PRODUCT_ID}:${body}`).digest()
  let out = ''
  for (let index = 0; index < 4; index += 1) out += LETTERS[hash[index] % LETTERS.length]
  return out
}

function normalizeKey(raw) {
  const clean = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const signed = clean.match(/^BLANKBO([A-Z]{4})([A-Z]{4})$/)
  if (signed) return `BLANK-BO-${signed[1]}-${signed[2]}`
  const legacy = clean.match(/^BLANK([A-Z]{4})([A-Z]{4})$/)
  if (legacy) return `BLANK-${legacy[1]}-${legacy[2]}`
  return String(raw || '').toUpperCase().trim()
}

function keyKind(key) {
  const signed = key.match(/^BLANK-BO-([A-Z]{4})-([A-Z]{4})$/)
  if (signed) return signed[2] === checksumLetters(signed[1]) ? 'signed' : 'bad'
  if (/^BLANK-[A-Z]{4}-[A-Z]{4}$/.test(key)) return 'legacy'
  if (/^BLANK-[A-Z]{2}-[A-Z]{4}-[A-Z]{4}$/.test(key)) return 'other'
  return 'bad'
}

function serverAccepted(json) {
  if (!json || typeof json !== 'object') return false
  if (json.ok) return true
  return OK_CODES.has(String(json.code || '').toUpperCase())
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

function hardware() {
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
      return {
        hardwareId: crypto.createHash('sha256').update(parts.join('|')).digest('hex').toUpperCase(),
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

async function verifyKey(raw, mode) {
  const key = normalizeKey(raw)
  if (!key) return { ok: false, message: 'Enter your license key.' }
  const kind = keyKind(key)
  if (kind === 'other') return { ok: false, message: 'This key is for a different Blank Delay product.' }
  if (kind === 'bad') return { ok: false, message: 'Use a Blank Optimizer key (BLANK-BO-XXXX-XXXX) from the Blank Delay Discord bot.' }
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
    return { ok: false, message: json?.message || json?.error || 'That key was rejected.' }
  } catch {
    if (kind === 'signed') return { ok: true, key, offline: true }
    return { ok: false, message: 'Could not reach the Blank license bot.' }
  }
}

function readSavedKey() {
  try {
    return normalizeKey(JSON.parse(fs.readFileSync(sessionPath(), 'utf8'))?.key || '')
  } catch {
    return ''
  }
}

export async function redeemOptimizerLicense(raw) {
  const result = await verifyKey(raw, 'redeem')
  if (result.ok) {
    fs.mkdirSync(path.dirname(sessionPath()), { recursive: true })
    fs.writeFileSync(sessionPath(), JSON.stringify({ key: result.key }))
  }
  return result
}

export async function restoreOptimizerLicense() {
  const key = readSavedKey()
  if (!key) return { ok: false }
  const result = await verifyKey(key, 'validate')
  if (!result.ok) clearOptimizerLicense()
  return result
}

export function clearOptimizerLicense() {
  fs.rmSync(sessionPath(), { force: true })
}
