const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('keyboardWindow', {
  minimize: () => ipcRenderer.send('keyboard-window-min'),
  maximize: () => ipcRenderer.send('keyboard-window-max'),
  close: () => ipcRenderer.send('keyboard-window-close'),
})

contextBridge.exposeInMainWorld('keyboardOptimizer', {
  start: () => ipcRenderer.invoke('keyboard:start'),
  stop: () => ipcRenderer.invoke('keyboard:stop'),
  applyDelay: (code, delayMs) => ipcRenderer.invoke('keyboard:apply-delay', { code, delayMs }),
  status: () => ipcRenderer.invoke('keyboard:status'),
  devices: () => ipcRenderer.invoke('keyboard:devices'),
  redeemLicense: (key) => ipcRenderer.invoke('keyboard:license-redeem', key),
  validateLicense: (key) => ipcRenderer.invoke('keyboard:license-validate', key),
  rememberedKey: () => ipcRenderer.invoke('keyboard:license-remembered'),
  hardware: () => ipcRenderer.invoke('keyboard:hardware'),
  openDiscord: () => ipcRenderer.invoke('keyboard:open-discord'),
})
