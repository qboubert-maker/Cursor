const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('optimizerWindow', {
  minimize: () => ipcRenderer.send('optimizer-window-min'),
  maximize: () => ipcRenderer.send('optimizer-window-max'),
  close: () => ipcRenderer.send('optimizer-window-close'),
  openDiscord: () => ipcRenderer.send('optimizer-window-discord'),
  openLink: (url) => ipcRenderer.invoke('optimizer-open-link', String(url || '')),
  redeemLicense: (key) => ipcRenderer.invoke('optimizer-license-redeem', String(key || '')),
  restoreLicense: () => ipcRenderer.invoke('optimizer-license-restore'),
  launchGame: (id) => ipcRenderer.invoke('optimizer-game-launch', String(id || '')),
  clipsStatus: () => ipcRenderer.invoke('optimizer-clips-status'),
  clipsStart: (prefs) => ipcRenderer.invoke('optimizer-clips-start', prefs || {}),
  clipsLive: (sessionId, warning, fps) => ipcRenderer.invoke('optimizer-clips-live', String(sessionId || ''), String(warning || ''), Number(fps) || 0),
  clipsChunk: (sessionId, bytes) => ipcRenderer.invoke('optimizer-clips-chunk', {
    sessionId: String(sessionId || ''),
    bytes: bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes,
  }),
  clipsFinish: (sessionId) => ipcRenderer.invoke('optimizer-clips-finish', String(sessionId || '')),
  clipsReplay: (payload) => ipcRenderer.invoke('optimizer-clips-replay', payload || {}),
  clipsHotkeyHold: (held) => ipcRenderer.invoke('optimizer-clips-hotkey-hold', Boolean(held)),
  clipsStop: () => ipcRenderer.invoke('optimizer-clips-stop'),
  clipsSave: (payload) => ipcRenderer.invoke('optimizer-clips-save', payload || {}),
  clipsDiscard: () => ipcRenderer.invoke('optimizer-clips-discard'),
  clipsAbort: (message) => ipcRenderer.invoke('optimizer-clips-abort', String(message || '')),
  clipsDelete: (id) => ipcRenderer.invoke('optimizer-clips-delete', String(id || '')),
  clipsReveal: (id) => ipcRenderer.invoke('optimizer-clips-reveal', String(id || '')),
  clipsOpen: (id) => ipcRenderer.invoke('optimizer-clips-open', String(id || '')),
  clipsFrame: () => ipcRenderer.invoke('optimizer-clips-frame'),
  clipsSource: () => ipcRenderer.invoke('optimizer-clips-source'),
  clipsPrefs: (prefs) => ipcRenderer.invoke('optimizer-clips-prefs', prefs || {}),
  keyboardStatus: () => ipcRenderer.invoke('keyboard:status'),
  keyboardStart: () => ipcRenderer.invoke('keyboard:start'),
  keyboardStop: () => ipcRenderer.invoke('keyboard:stop'),
  keyboardApply: (code, delayMs) => ipcRenderer.invoke('keyboard:apply-delay', { code, delayMs }),
  padStatus: () => ipcRenderer.invoke('controller:get-active-status'),
  padStart: (consoleType) => ipcRenderer.invoke('controller:start-engine', { consoleType }),
  padStop: () => ipcRenderer.invoke('controller:stop-engine'),
  padOutput: (consoleType) => ipcRenderer.invoke('controller:set-output', { consoleType }),
  padApply: (consoleType, button, delayMs) => ipcRenderer.invoke('controller:apply-delay', { consoleType, button, delayMs }),
  tweaksState: () => ipcRenderer.invoke('optimizer-tweaks-state'),
  tweaksApply: (ids) => ipcRenderer.invoke('optimizer-tweaks-apply', Array.isArray(ids) ? ids.map(String) : []),
  tweaksRevert: (ids) => ipcRenderer.invoke('optimizer-tweaks-revert', Array.isArray(ids) ? ids.map(String) : []),
  onClipsEvent: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('optimizer-clips-event', listener)
    return () => ipcRenderer.removeListener('optimizer-clips-event', listener)
  },
})
