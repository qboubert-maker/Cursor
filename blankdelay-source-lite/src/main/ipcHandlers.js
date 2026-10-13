import { app, BrowserWindow, ipcMain } from 'electron'
import { redeemControllerLicense, validateControllerLicense } from './license.js'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))

function profilesPath() {
  if (app.isPackaged) return path.join(app.getPath('userData'), 'controller_profiles.json')
  return path.resolve(here, '../../config/controller_profiles.json')
}

function resolveAddon() {
  const bundled = path.resolve(here, '../../build/Release/blank_delay_engine.node')
  const unpacked = bundled.replace('app.asar', 'app.asar.unpacked')
  return fsSync.existsSync(unpacked) ? unpacked : bundled
}

const addonPath = resolveAddon()

const BUTTONS = ['L3', 'R3', 'L1', 'R1', 'L2', 'R2', 'A', 'B', 'X', 'Y', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'SHARE', 'OPTIONS', 'TOUCH', 'PS']

function emptyDelays() {
  return Object.fromEntries(BUTTONS.map((button) => [button, 0]))
}

function emptyProfiles() {
  return { ps5: emptyDelays(), xbox: emptyDelays() }
}

let native = null
let nativeError = ''
try {
  native = require(addonPath)
} catch (error) {
  native = null
  nativeError = error instanceof Error ? error.message : 'Native engine is not built'
}

let profiles = emptyProfiles()
let profilesStamp = -1
let activeDelays = emptyDelays()
let running = false

function normalizeDelay(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 1) return 0
  const rounded = Math.round(n)
  if (rounded > 10) return 10
  return rounded
}

function clampProfile(source) {
  const delays = emptyDelays()
  for (const button of BUTTONS) delays[button] = normalizeDelay(source?.[button] ?? 0)
  return delays
}

async function readProfiles() {
  const file = profilesPath()
  try {
    const { mtimeMs } = await fs.stat(file)
    if (mtimeMs === profilesStamp) return profiles
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'))
    profiles = {
      ps5: clampProfile(parsed.ps5),
      xbox: clampProfile(parsed.xbox),
    }
    profilesStamp = mtimeMs
  } catch {
    profiles = emptyProfiles()
    profilesStamp = -1
  }
  return profiles
}

async function writeProfiles() {
  const file = profilesPath()
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(profiles, null, 2))
}

function nativeStatus() {
  if (!native?.GetStatus) {
    return {
      running,
      native: false,
      nativeError,
      timerResolutionMs: 0,
      qpcFrequency: 0,
      lastJitterUs: 0,
      queueDepth: 0,
      delays: emptyDelays(),
      liveButtons: [],
      buttons: BUTTONS.map((buttonName) => ({ buttonName, targetDelayMs: 0, enabled: true })),
    }
  }
  const status = native.GetStatus()
  return { ...status, native: true, nativeError: '' }
}

function snapshot() {
  const status = nativeStatus()
  if (!native) status.delays = { ...activeDelays }
  return { ...status, running: native ? Boolean(status.running) : Boolean(running), profiles }
}

function publish() {
  const status = snapshot()
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('controller:status', status)
  }
  return status
}

function applyNativeProfile(consoleType) {
  const saved = profiles[consoleType] || emptyDelays()
  if (!native?.SetDelay) return
  let fastest = 10
  for (const [button, delayMs] of Object.entries(saved)) {
    const delay = Number(delayMs) || 0
    native.SetDelay(button, delay)
    if (delay < fastest) fastest = delay
  }
  if (native.SetPoll) native.SetPoll(fastest)
}

export async function startControllerEngine(consoleType = 'ps5') {
  const pad = consoleType === 'xbox' ? 'xbox' : 'ps5'
  await readProfiles()
  if (native?.SetConsole) native.SetConsole(pad)
  if (!running) {
    if (native?.InitEngine) native.InitEngine()
    running = true
    applyNativeProfile(pad)
  }
  return publish()
}

export function registerControllerIpc() {
  ipcMain.handle('controller:start-engine', async (_event, payload = {}) => {
    const consoleType = payload?.consoleType === 'xbox' ? 'xbox' : 'ps5'
    return { ok: true, status: await startControllerEngine(consoleType) }
  })

  ipcMain.handle('controller:stop-engine', async () => {
    if (native?.StopEngine) native.StopEngine()
    running = false
    return { ok: true, status: publish() }
  })

  ipcMain.handle('controller:set-output', async (_event, payload = {}) => {
    const consoleType = payload.consoleType === 'xbox' ? 'xbox' : 'ps5'
    if (native?.SetConsole) native.SetConsole(consoleType)
    return { ok: true, status: publish() }
  })

  ipcMain.handle('controller:apply-delay', async (_event, payload = {}) => {
    const consoleType = payload.consoleType === 'xbox' ? 'xbox' : 'ps5'
    const button = String(payload.button || '')
    const delayMs = normalizeDelay(payload.delayMs)
    if (!BUTTONS.includes(button) || delayMs < 0 || delayMs > 10) {
      return { ok: false, error: 'Choose a bind and a delay from 0 to 10 ms', status: snapshot() }
    }
    if (!native) return { ok: false, error: 'Controller driver is not built', status: snapshot() }
    await readProfiles()
    if (!running) {
      if (native?.SetConsole) native.SetConsole(consoleType)
      if (native?.InitEngine) native.InitEngine()
      running = true
      applyNativeProfile(consoleType)
    }
    if (native?.SetConsole) native.SetConsole(consoleType)
    const accepted = native?.SetDelay ? native.SetDelay(button, delayMs) : true
    if (native?.SetPoll) native.SetPoll(delayMs)
    profiles[consoleType][button] = delayMs
    activeDelays[button] = delayMs
    await writeProfiles()
    return {
      ok: accepted !== false,
      error: accepted === false ? 'The engine rejected that bind' : '',
      status: publish(),
    }
  })

  ipcMain.handle('controller:get-active-status', async () => {
    await readProfiles()
    return { ok: true, status: snapshot() }
  })

  ipcMain.handle('controller:redeem-license', async (_event, key) => redeemControllerLicense(key))
  ipcMain.handle('controller:validate-license', async (_event, key) => validateControllerLicense(key))
}

export async function stopControllerEngine() {
  if (native?.StopEngine) native.StopEngine()
  running = false
}
