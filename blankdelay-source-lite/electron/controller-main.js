import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerControllerIpc, stopControllerEngine } from '../src/main/ipcHandlers.js'

const here = path.dirname(fileURLToPath(import.meta.url))

let win

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#000000',
    title: 'Blank Delay Controller Optimizer',
    icon: path.join(here, 'blank-delay.ico'),
    frame: false,
    fullscreen: true,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
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
  if (app.isPackaged) win.loadFile(path.join(app.getAppPath(), 'dist-app', 'controller.html'))
  else win.loadURL(process.env.CONTROLLER_URL || 'http://127.0.0.1:5174/controller')
}

ipcMain.on('window-min', () => win?.minimize())
ipcMain.on('window-max', () => {
  if (!win) return
  win.setFullScreen(!win.isFullScreen())
})
ipcMain.on('window-close', () => win?.close())

registerControllerIpc()

app.whenReady().then(() => {
  createWindow()
})
app.on('window-all-closed', () => {
  stopControllerEngine()
  app.quit()
})
