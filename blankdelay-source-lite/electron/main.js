import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

let win

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#e4ddd3',
    title: 'Blank Delay — Console Controller Macro',
    frame: false,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.once('ready-to-show', () => win.show())
  win.loadURL(process.env.CONSOLE_URL || 'http://127.0.0.1:5174/console')
}

ipcMain.on('window-min', () => win?.minimize())
ipcMain.on('window-max', () => {
  if (!win) return
  if (win.isMaximized()) win.unmaximize()
  else win.maximize()
})
ipcMain.on('window-close', () => win?.close())

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
