import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerKeyboardIpc, stopKeyboardEngine } from './keyboard-ipc.js'
import { keyboardHardware, readSavedKey, redeemKeyboardLicense, validateKeyboardLicense } from './keyboard-license.js'

const here = path.dirname(fileURLToPath(import.meta.url))
app.setPath('userData', path.join(app.getPath('appData'), 'blank-keyboard-optimizer'))

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#000000',
    title: 'Keyboard Optimizer',
    icon: path.join(here, 'blank-delay.ico'),
    frame: false,
    fullscreen: true,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(here, 'keyboard-loader-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.on('page-title-updated', (event) => event.preventDefault())
  win.once('ready-to-show', () => {
    if (win.isMinimized()) win.restore()
    win.show()
    win.setFullScreen(true)
    win.focus()
  })
  if (app.isPackaged) win.loadFile(path.join(app.getAppPath(), 'dist-keyboard', 'keyboard.html'))
  else win.loadURL(process.env.KEYBOARD_URL || 'http://127.0.0.1:5174/keyboard.html')

  ipcMain.on('keyboard-window-min', () => win.minimize())
  ipcMain.on('keyboard-window-max', () => win.setFullScreen(!win.isFullScreen()))
  ipcMain.on('keyboard-window-close', () => win.close())
}

app.whenReady().then(() => {
  registerKeyboardIpc()
  ipcMain.handle('keyboard:license-redeem', (_event, key) => redeemKeyboardLicense(key))
  ipcMain.handle('keyboard:license-validate', (_event, key) => validateKeyboardLicense(key))
  ipcMain.handle('keyboard:license-remembered', () => ({ key: readSavedKey() }))
  ipcMain.handle('keyboard:hardware', () => keyboardHardware())
  ipcMain.handle('keyboard:open-discord', () => shell.openExternal('https://discord.gg/GYaWCa7rB7'))
  createWindow()
})
app.on('before-quit', () => stopKeyboardEngine())
app.on('window-all-closed', () => app.quit())
