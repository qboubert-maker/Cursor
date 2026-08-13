const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('blankDelay', {
    getProductInfo: () => ipcRenderer.invoke('get-product-info'),
    validateKey: (key) => ipcRenderer.invoke('validate-key', key),
    runTweaks: (tweakList) => ipcRenderer.invoke('run-tweaks', tweakList),
    runSingleTweak: (cmd) => ipcRenderer.invoke('run-single-tweak', cmd),
    checkAdmin: () => ipcRenderer.invoke('check-admin'),
    restartAsAdmin: () => ipcRenderer.invoke('restart-as-admin'),
    getSystemMetrics: (type) => ipcRenderer.invoke('get-system-metrics', type),
    detectDevices: () => ipcRenderer.invoke('detect-devices'),
    startMacroEngine: (config) => ipcRenderer.invoke('start-macro-engine', config),
    stopMacroEngine: () => ipcRenderer.invoke('stop-macro-engine'),
    fireMacro: (keysOrConfig, delayMs) => {
        if (keysOrConfig && typeof keysOrConfig === 'object') {
            return ipcRenderer.invoke('fire-macro', keysOrConfig);
        }
        return ipcRenderer.invoke('fire-macro', { keys: keysOrConfig, speed: delayMs });
    },
    pollInputState: () => ipcRenderer.invoke('poll-input-state'),
    listMacroProfiles: (product) => ipcRenderer.invoke('list-macro-profiles', product),
    saveMacroProfile: (product, name, profile) => ipcRenderer.invoke('save-macro-profile', product, name, profile),
    loadMacroProfile: (product, name) => ipcRenderer.invoke('load-macro-profile', product, name),
    deleteMacroProfile: (product, name) => ipcRenderer.invoke('delete-macro-profile', product, name),
    exportFortniteSettings: (data) => ipcRenderer.invoke('export-fortnite-settings', data),
    launchProduct: (key) => ipcRenderer.invoke('launch-product', key),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    onMacroFired: (cb) => ipcRenderer.on('macro-fired', (_e, data) => cb(data)),
    onMacroPanic: (cb) => ipcRenderer.on('macro-panic', () => cb()),
    detectFortniteHud: () => ipcRenderer.invoke('detect-fortnite-hud'),
    startAimAssist: (config) => ipcRenderer.invoke('start-aim-assist', config),
    stopAimAssist: () => ipcRenderer.invoke('stop-aim-assist'),
    setAimForce: (data) => ipcRenderer.invoke('set-aim-force', data),
    onAimStatus: (cb) => ipcRenderer.on('aim-status', (_e, data) => cb(data)),
    toggleAimArmed: () => ipcRenderer.invoke('toggle-aim-armed'),
    reportAimInput: (data) => ipcRenderer.invoke('report-aim-input', data)
});
