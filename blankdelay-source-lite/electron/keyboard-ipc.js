import { ipcMain, app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))

let native = null
let running = false
let pollMs = null
const poll = { keyboard: null, mouse: null }
const delays = {}

function knownCode(code) {
  return Number.isInteger(code) && code >= 1 && code <= 263
}

function pollKind(code) {
  return code >= 257 ? 'mouse' : 'keyboard'
}

function pollValue(value) {
  if (value == null || value === '') return null
  const ms = Math.round(Number(value))
  return Number.isFinite(ms) ? Math.min(10, Math.max(0, ms)) : null
}

function profilesPath() {
  return path.join(app.getPath('userData'), 'keyboard_delays.json')
}

function nativeFile() {
  const bundled = path.join(here, '../build/Release/blank_keyboard_engine.node')
  const unpacked = bundled.replace('app.asar', 'app.asar.unpacked')
  return fs.existsSync(unpacked) ? unpacked : bundled
}

function loadNative() {
  if (native) return native
  native = require(nativeFile())
  return native
}

function readProfiles() {
  try {
    const saved = JSON.parse(fs.readFileSync(profilesPath(), 'utf8'))
    for (const key of Object.keys(delays)) delete delays[key]
    for (const [key, value] of Object.entries(saved?.delays || {})) {
      const code = Math.round(Number(key))
      const ms = Math.round(Number(value) || 0)
      if (knownCode(code) && ms >= 0 && ms <= 10) delays[String(code)] = ms
    }
    pollMs = pollValue(saved?.pollMs)
    poll.keyboard = pollValue(saved?.poll?.keyboard ?? saved?.pollMs)
    poll.mouse = pollValue(saved?.poll?.mouse ?? saved?.pollMs)
  } catch {
    /* first run */
  }
}

function writeProfiles() {
  fs.mkdirSync(path.dirname(profilesPath()), { recursive: true })
  fs.writeFileSync(profilesPath(), JSON.stringify({ delays, pollMs, poll }))
}

function snapshot() {
  const status = native?.GetStatus ? native.GetStatus() : { running: false, delays: { ...delays }, measuredHz: 0, pollHz: 8000, pollMessage: 'Turn on the keyboard driver', route: '' }
  return { ...status, running: Boolean(status.running), profiles: { ...delays } }
}

export function stopKeyboardEngine() {
  if (native?.Stop) native.Stop()
  running = false
}

export function registerKeyboardIpc() {
  readProfiles()

  ipcMain.handle('keyboard:status', async () => ({ ok: true, status: snapshot() }))

  ipcMain.handle('keyboard:start', async () => {
    try {
      loadNative()
    } catch {
      return { ok: false, error: 'Keyboard driver is not built', status: snapshot() }
    }
    readProfiles()
    if (!running) {
      const started = native.Start()
      running = Boolean(started)
      if (!running) return { ok: false, error: 'Could not start the keyboard driver', status: snapshot() }
      for (const [code, delay] of Object.entries(delays)) native.SetDelay(Number(code), delay)
    }
    return { ok: true, status: snapshot() }
  })

  ipcMain.handle('keyboard:stop', async () => {
    stopKeyboardEngine()
    return { ok: true, status: snapshot() }
  })

  ipcMain.handle('keyboard:devices', async () => {
    try {
      loadNative()
    } catch {
      return { ok: false, keyboards: [], mice: [] }
    }
    const status = native.GetStatus()
    return { ok: true, keyboards: status.keyboards || [], mice: status.mice || [] }
  })

  ipcMain.handle('keyboard:apply-delay', async (_event, payload = {}) => {
    const code = Math.round(Number(payload.code))
    const delayMs = Math.round(Number(payload.delayMs) || 0)
    if (!knownCode(code) || delayMs < 0 || delayMs > 10) {
      return { ok: false, error: 'Choose a key and a delay from 0 to 10 ms', status: snapshot() }
    }
    if (!running) {
      return { ok: false, error: 'Turn on the keyboard driver in Settings', status: snapshot() }
    }
    const accepted = native?.SetDelay ? native.SetDelay(code, delayMs) : false
    if (accepted === false) return { ok: false, error: 'The driver rejected that key', status: snapshot() }
    const kind = pollKind(code)
    if (native?.SetPoll) native.SetPoll(delayMs, kind)
    delays[String(code)] = delayMs
    pollMs = delayMs
    poll[kind] = delayMs
    writeProfiles()
    return { ok: true, status: snapshot() }
  })
}
