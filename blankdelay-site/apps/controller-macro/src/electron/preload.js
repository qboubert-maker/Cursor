'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const api = {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  fullscreen: () => ipcRenderer.invoke('window:fullscreen'),
  isFullscreen: () => ipcRenderer.invoke('window:isFullscreen'),
  onFullscreenChange: (fn) => {
    const handler = (_event, on) => fn(!!on);
    ipcRenderer.on('window:fullscreen-changed', handler);
    return () => ipcRenderer.off('window:fullscreen-changed', handler);
  },
  close: () => ipcRenderer.invoke('window:close'),
  hide: () => ipcRenderer.invoke('window:hide'),
  quit: () => ipcRenderer.invoke('window:quit'),
  show: () => ipcRenderer.invoke('window:show'),
  onCloseAsk: (fn) => {
    const handler = () => fn();
    ipcRenderer.on('window:close-ask', handler);
    return () => ipcRenderer.off('window:close-ask', handler);
  },
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  drivers: {
    status: () => ipcRenderer.invoke('drivers:status'),
    install: (ids) => ipcRenderer.invoke('drivers:install', ids),
    open: (id) => ipcRenderer.invoke('drivers:open', id),
    onProgress: (cb) => {
      const handler = (_event, payload) => cb(payload);
      ipcRenderer.on('drivers:progress', handler);
      return () => ipcRenderer.off('drivers:progress', handler);
    },
  },
  hidhide: {
    status: () => ipcRenderer.invoke('hidhide:status'),
    set: (on) => ipcRenderer.invoke('hidhide:set', !!on),
    onChanged: (cb) => {
      const handler = (_event, payload) => cb(payload);
      ipcRenderer.on('hidhide:changed', handler);
      return () => ipcRenderer.off('hidhide:changed', handler);
    },
  },
  vigem: {
    status: () => ipcRenderer.invoke('vigem:status'),
  },
  input: {
    status: () => ipcRenderer.invoke('input:status'),
  },
  tapLengthStatus: () => ipcRenderer.invoke('tapLength:status'),
  macros: {
    setConfig: (partial) => ipcRenderer.invoke('macro:config', partial),
    getConfig: () => ipcRenderer.invoke('macro:getConfig'),
    status: () => ipcRenderer.invoke('macro:status'),
    debug: () => ipcRenderer.invoke('macro:debug'),
  },
  getLicenseHardware: () => ipcRenderer.invoke('nova-license-hardware'),
  redeemLicense: (key) => ipcRenderer.invoke('nova-license-redeem', key),
  validateLicense: (key) => ipcRenderer.invoke('nova-license-validate', key),
  verifyLicenseKey: (key) => ipcRenderer.invoke('verify-license-key', key),
  getLicenseStatus: () => ipcRenderer.invoke('nova-license-status'),
  getSession: () => ipcRenderer.invoke('get-session'),
  saveSession: (data) => ipcRenderer.invoke('save-session', data),
  getHWID: () => ipcRenderer.invoke('get-hwid'),
  clearLicense: () => ipcRenderer.invoke('nova-license-clear'),
  licenseUnlocked: () => ipcRenderer.invoke('license:unlocked'),
};

contextBridge.exposeInMainWorld('blank', api);
contextBridge.exposeInMainWorld('sjay', api);
contextBridge.exposeInMainWorld('aphrodite', api);
