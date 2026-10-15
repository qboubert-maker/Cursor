const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('appWindow', {
  minimize: () => ipcRenderer.send('window-min'),
  maximize: () => ipcRenderer.send('window-max'),
  close: () => ipcRenderer.send('window-close'),
})

contextBridge.exposeInMainWorld('controllerOptimizer', {
  applyDelay: (payload) => ipcRenderer.invoke('controller:apply-delay', payload),
  getActiveStatus: () => ipcRenderer.invoke('controller:get-active-status'),
  toggleEngine: (enabled, consoleType) => ipcRenderer.invoke(enabled ? 'controller:start-engine' : 'controller:stop-engine', { consoleType }),
  setOutput: (payload) => ipcRenderer.invoke('controller:set-output', payload),
  redeemLicense: (key) => ipcRenderer.invoke('controller:redeem-license', key),
  validateLicense: (key) => ipcRenderer.invoke('controller:validate-license', key),
  onStatus: (callback) => {
    const listener = (_event, status) => callback(status)
    ipcRenderer.on('controller:status', listener)
    return () => ipcRenderer.removeListener('controller:status', listener)
  },
})
