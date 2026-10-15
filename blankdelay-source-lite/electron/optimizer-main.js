import { app, BrowserWindow, ipcMain, net, protocol, shell } from 'electron'
import { shutdownClips, startClips, watchClipEncoding } from './optimizer-clips.js'
import { registerKeyboardIpc, stopKeyboardEngine } from './keyboard-ipc.js'
import { registerControllerIpc, stopControllerEngine } from '../src/main/ipcHandlers.js'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'blank-clip',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true, bypassCSP: true },
  },
  {
    scheme: 'blank-app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
  },
])
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { redeemOptimizerLicense, restoreOptimizerLicense } from './optimizer-license.js'
import { restoreTaskbarNow, setTaskbarHidden, warmTaskbarGuard } from './taskbar-guard.js'
import { createTweakEngine } from './optimizer-tweak-engine.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const SYSTEM32 = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32')
app.setPath('userData', path.join(app.getPath('appData'), 'blank-the-optimizer'))

function runningElevated() {
  try {
    const groups = execFileSync(path.join(SYSTEM32, 'whoami.exe'), ['/groups', '/fo', 'csv'], { encoding: 'utf8', windowsHide: true, timeout: 4000 })
    return /S-1-16-(12288|16384)/.test(groups)
  } catch {
    return true
  }
}

function relaunchElevated() {
  const quote = (value) => `'${String(value).replace(/'/g, "''")}'`
  const args = [...process.argv.slice(1), '--blank-elevated'].map((arg) => quote(`"${arg}"`)).join(',')
  const cwd = app.isPackaged ? path.dirname(process.execPath) : process.cwd()
  const target = `-FilePath ${quote(process.execPath)} -ArgumentList ${args} -WorkingDirectory ${quote(cwd)}`
  const script = `try { Start-Process ${target} -Verb RunAs -ErrorAction Stop } catch { Start-Process ${target} }`
  spawn(path.join(SYSTEM32, 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', script], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  }).unref()
}

const relaunching = process.platform === 'win32' && !process.argv.includes('--blank-elevated') && !runningElevated()
if (relaunching) {
  relaunchElevated()
  app.exit(0)
}

const tweaks = createTweakEngine(path.join(app.getPath('userData'), 'tweaks-journal.json'))
const tweakIds = (ids) => (Array.isArray(ids) ? ids.filter((id) => typeof id === 'string').slice(0, 400) : [])
ipcMain.handle('optimizer-tweaks-state', () => tweaks.state())
ipcMain.handle('optimizer-tweaks-apply', (_event, ids) => tweaks.apply(tweakIds(ids)))
ipcMain.handle('optimizer-tweaks-revert', (_event, ids) => tweaks.revert(tweakIds(ids)))

const GAME_LAUNCH = {
  fortnite: 'com.epicgames.launcher://apps/fn%3A4fe75bbc5a674f4f9b356b5c90567da5%3AFortnite?action=launch&silent=true',
  warzone: 'steam://rungameid/1938090',
  apex: 'steam://rungameid/1172470',
  valorant: 'riotclient://launch?product=valorant&patchline=live',
  cs2: 'steam://rungameid/730',
  'r6-siege': 'steam://rungameid/359550',
  'rocket-league': 'steam://rungameid/252950',
  overwatch2: 'battlenet://Pro',
  'marvel-rivals': 'steam://rungameid/2767030',
  minecraft: 'minecraft://',
  gta5: 'steam://rungameid/271590',
  lol: 'riotclient://launch?product=league_of_legends&patchline=live',
  'elden-ring': 'steam://rungameid/1245620',
  fivem: 'fivem://',
  'destiny-2': 'steam://rungameid/1085660',
  'helldivers-2': 'steam://rungameid/553850',
  pubg: 'steam://rungameid/578080',
}

ipcMain.handle('optimizer-license-redeem', (_event, key) => redeemOptimizerLicense(key))
ipcMain.handle('optimizer-license-restore', () => restoreOptimizerLicense())
async function handOffDisplay() {
  const win = mainWindow
  if (!win || win.isDestroyed()) return
  win.webContents.setBackgroundThrottling(!clipEncoding)
  if (win.isFullScreen()) {
    await new Promise((resolve) => {
      let settled = false
      const done = () => {
        if (settled) return
        settled = true
        resolve()
      }
      win.once('leave-full-screen', done)
      win.setFullScreen(false)
      setTimeout(done, 800)
    })
  }
  if (win.isDestroyed()) return
  restoreTaskbarNow()
  win.minimize()
  applyHelperPriority()
}

ipcMain.handle('optimizer-game-launch', async (_event, id) => {
  const uri = GAME_LAUNCH[id]
  if (!uri) return { ok: false }
  try {
    await handOffDisplay()
    await shell.openExternal(uri)
    return { ok: true }
  } catch {
    return { ok: false }
  }
})

const SOCIAL_HOSTS = ['discord.gg', 'tiktok.com', 'instagram.com', 'youtube.com', 'youtu.be']

function socialUrl(value) {
  let parsed
  try {
    parsed = new URL(String(value || ''))
  } catch {
    return null
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
  const allowed = SOCIAL_HOSTS.some((name) => host === name || host.endsWith(`.${name}`))
  if (parsed.protocol !== 'https:' || !allowed) return null
  return parsed.href
}

ipcMain.handle('optimizer-open-link', async (_event, url) => {
  const href = socialUrl(url)
  if (!href) return { ok: false }
  try {
    await shell.openExternal(href)
    return { ok: true }
  } catch {
    return { ok: false }
  }
})

let mainWindow = null
let clipEncoding = false

function applyHelperPriority() {
  const win = mainWindow
  if (!win || win.isDestroyed()) return
  const background = !win.isFocused() || win.isMinimized()
  const priority = background && !clipEncoding ? os.constants.priority.PRIORITY_BELOW_NORMAL : os.constants.priority.PRIORITY_NORMAL
  const pids = new Set()
  try { pids.add(win.webContents.getOSProcessId()) } catch { /* renderer gone */ }
  for (const metric of app.getAppMetrics()) {
    if (metric.type === 'GPU') pids.add(metric.pid)
  }
  for (const pid of pids) {
    if (!pid || pid === process.pid) continue
    try { os.setPriority(pid, priority) } catch { /* process gone */ }
  }
}

function registerAppProtocol() {
  const root = path.resolve(app.getAppPath(), 'dist-optimizer')
  protocol.handle('blank-app', (request) => {
    let pathname = '/'
    try {
      pathname = decodeURIComponent(new URL(request.url).pathname)
    } catch {
      return new Response('bad', { status: 400 })
    }
    if (pathname === '/' || pathname.endsWith('/')) pathname = `${pathname}optimizer.html`.replace(/\/{2,}/g, '/')
    const file = path.resolve(root, pathname.replace(/^\/+/, ''))
    const relative = path.relative(root, file)
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return new Response('forbidden', { status: 403 })
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response('missing', { status: 404 })
    return net.fetch(pathToFileURL(file).href)
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 680,
    backgroundColor: '#0D0E12',
    title: 'The Blank Optimizer',
    icon: path.join(here, 'blank-delay.ico'),
    frame: false,
    fullscreen: true,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(here, 'optimizer-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  })
  mainWindow = win
  win.webContents.setBackgroundThrottling(false)

  win.on('page-title-updated', (event) => event.preventDefault())
  win.webContents.setWindowOpenHandler(({ url }) => {
    const href = socialUrl(url)
    if (href) shell.openExternal(href)
    return { action: 'deny' }
  })
  ipcMain.on('optimizer-window-min', () => win.minimize())
  ipcMain.on('optimizer-window-max', () => win.setFullScreen(!win.isFullScreen()))
  ipcMain.on('optimizer-window-close', () => win.close())
  ipcMain.on('optimizer-window-discord', () => shell.openExternal('https://discord.gg/zGPeKmB9sd'))
  let focused = false
  const syncTaskbar = () => {
    if (win.isDestroyed()) return
    setTaskbarHidden(focused && win.isFullScreen() && !win.isMinimized())
  }
  const syncThrottle = () => {
    if (win.isDestroyed()) return
    const away = !win.isFocused() || win.isMinimized()
    win.webContents.setBackgroundThrottling(away && !clipEncoding)
  }
  win.on('focus', () => {
    focused = true
    syncTaskbar()
    syncThrottle()
    applyHelperPriority()
  })
  win.on('blur', () => {
    focused = false
    syncTaskbar()
    syncThrottle()
    applyHelperPriority()
  })
  win.on('minimize', () => {
    syncTaskbar()
    syncThrottle()
    applyHelperPriority()
  })
  win.on('restore', () => {
    syncThrottle()
    applyHelperPriority()
  })
  win.on('enter-full-screen', syncTaskbar)
  win.on('leave-full-screen', syncTaskbar)
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
    restoreTaskbarNow()
  })
  win.once('ready-to-show', () => {
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
    win.setFullScreen(true)
    focused = win.isFocused()
    syncTaskbar()
    applyHelperPriority()
  })
  if (app.isPackaged) win.loadURL('blank-app://local/optimizer.html')
  else win.loadURL(process.env.OPTIMIZER_URL || 'http://127.0.0.1:5174/optimizer.html')
}

app.whenReady().then(() => {
  if (relaunching) return
  watchClipEncoding((active) => {
    clipEncoding = active
    const win = mainWindow
    if (win && !win.isDestroyed()) {
      const away = !win.isFocused() || win.isMinimized()
      win.webContents.setBackgroundThrottling(away && !clipEncoding)
    }
    applyHelperPriority()
  })
  warmTaskbarGuard()
  registerKeyboardIpc()
  registerControllerIpc()
  startClips(() => mainWindow)
  if (app.isPackaged) registerAppProtocol()
  createWindow()
  setTimeout(() => tweaks.warm(), 3500)
})
app.on('window-all-closed', () => app.quit())
app.on('will-quit', () => {
  stopKeyboardEngine()
  stopControllerEngine()
  restoreTaskbarNow()
})
process.on('uncaughtException', (error) => {
  restoreTaskbarNow()
  stopKeyboardEngine()
  stopControllerEngine()
  shutdownClips()
  console.error(error)
  app.exit(1)
})
