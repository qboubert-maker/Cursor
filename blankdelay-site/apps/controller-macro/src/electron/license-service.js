'use strict';

const crypto = require('crypto');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const {
  loadSessionRecord,
  saveSessionRecord,
  clearSessionRecord,
} = require('./license-session-store');
const { verifyLicenseKeyInMain } = require('./license-verify');

const execFileAsync = promisify(execFile);

/** Offline grace after a successful SJTweaks validate (same idea as Zero Delay Plus session). */
const OFFLINE_GRACE_MS = 72 * 60 * 60 * 1000;
const REFRESH_INTERVAL_MS = 4 * 60 * 60 * 1000;

let refreshTimer = null;
let cachedStatus = { licensed: false, offline: false, reason: 'none' };
let hardwareCache = null;

function formatDeviceId(hash) {
  const clean = String(hash || '').replace(/[^a-fA-F0-9]/g, '').toUpperCase().slice(0, 16);
  if (!clean) return 'UNKNOWN-DEVICE';
  return clean.replace(/(.{4})(?=.)/g, '$1-');
}

async function wmicValue(args) {
  if (process.platform !== 'win32') return '';
  try {
    const { stdout } = await execFileAsync('wmic', args, {
      windowsHide: true,
      timeout: 8000,
      maxBuffer: 1024 * 64,
    });
    const lines = String(stdout)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 2) return '';
    return lines[1].trim();
  } catch {
    return '';
  }
}

async function getHardwareFingerprint() {
  if (hardwareCache) return hardwareCache;

  const parts = [
    await wmicValue(['csproduct', 'get', 'uuid']),
    await wmicValue(['diskdrive', 'get', 'serialnumber']),
    await wmicValue(['baseboard', 'get', 'serialnumber']),
    os.hostname(),
    os.arch(),
    String(os.cpus()?.[0]?.model || ''),
  ].filter((part) => part && part !== 'UUID' && !/^SerialNumber$/i.test(part));

  if (!parts.length) {
    parts.push(os.hostname(), os.platform(), os.release());
  }

  const hash = crypto.createHash('sha256').update(parts.join('|')).digest('hex').toUpperCase();
  hardwareCache = {
    hardwareId: hash,
    deviceId: formatDeviceId(hash),
    deviceLabel: os.hostname() || 'PC',
  };
  return hardwareCache;
}

function computeStatusFromRecord(record) {
  if (!record?.authenticated || !record?.licenseKey) {
    cachedStatus = { licensed: false, offline: false, reason: 'missing' };
    return cachedStatus;
  }
  const validatedAt = Number(record.validatedAt) || 0;
  const age = Date.now() - validatedAt;
  if (validatedAt > 0 && age > OFFLINE_GRACE_MS) {
    cachedStatus = { licensed: false, offline: false, reason: 'expired' };
    return cachedStatus;
  }
  cachedStatus = {
    licensed: true,
    offline: true,
    reason: 'session',
    product: record.product || 'blankdelay-controller',
    licenseKey: record.licenseKey,
  };
  return cachedStatus;
}

function persistSuccessfulSession(licenseKey) {
  const key = String(licenseKey || '').trim().toUpperCase();
  const record = {
    ok: true,
    authenticated: true,
    licenseKey: key,
    product: 'blankdelay-controller',
    validatedAt: Date.now(),
  };
  saveSessionRecord(record);
  cachedStatus = {
    licensed: true,
    offline: false,
    reason: 'ok',
    product: 'blankdelay-controller',
    licenseKey: key,
  };
  return cachedStatus;
}

function getLicenseStatus() {
  return cachedStatus;
}

async function refreshStoredSession(forceNetwork = false) {
  const record = loadSessionRecord();
  if (!record?.authenticated || !record?.licenseKey) {
    cachedStatus = { licensed: false, offline: false, reason: 'missing' };
    return cachedStatus;
  }

  const validatedAt = Number(record.validatedAt) || 0;
  const fresh = validatedAt > 0 && Date.now() - validatedAt < 15 * 60 * 1000;
  if (!forceNetwork && fresh) {
    return computeStatusFromRecord(record);
  }

    const result = await verifyLicenseKeyInMain(record.licenseKey, {
      hardwareId: (await getHardwareFingerprint()).hardwareId,
      deviceLabel: (await getHardwareFingerprint()).deviceLabel,
      mode: 'validate',
    });
  if (result?.ok) {
    return persistSuccessfulSession(record.licenseKey);
  }

  // Transient / offline → keep last good session within grace.
  if (!result?.message || /respond|internet|VPN|firewall|starting/i.test(result.message)) {
    return computeStatusFromRecord(record);
  }

  clearSessionRecord();
  cachedStatus = {
    licensed: false,
    offline: false,
    reason: 'invalid',
    message: result?.message || 'License key rejected.',
  };
  return cachedStatus;
}

async function redeemLicense(licenseKey) {
  const hw = await getHardwareFingerprint();
  const result = await verifyLicenseKeyInMain(String(licenseKey || ''), {
    hardwareId: hw.hardwareId,
    deviceLabel: hw.deviceLabel,
    mode: 'redeem',
  });
  if (!result?.ok) return result;
  persistSuccessfulSession(licenseKey);
  return {
    ok: true,
    product: 'blankdelay-controller',
    deviceId: hw.deviceId,
    message: 'License activated',
  };
}

async function validateLicense(licenseKey) {
  const hw = await getHardwareFingerprint();
  const result = await verifyLicenseKeyInMain(String(licenseKey || ''), {
    hardwareId: hw.hardwareId,
    deviceLabel: hw.deviceLabel,
    mode: 'validate',
  });
  if (!result?.ok) {
    return { ok: false, code: 'INVALID', message: result?.message || 'Invalid license key.' };
  }
  persistSuccessfulSession(licenseKey);
  return { ok: true, product: 'blankdelay-controller' };
}

function clearLicenseSession() {
  clearSessionRecord();
  cachedStatus = { licensed: false, offline: false, reason: 'cleared' };
}

function startLicenseRefreshLoop() {
  if (refreshTimer) return;
  refreshTimer = setInterval(() => {
    refreshStoredSession(true).catch((err) => {
      console.warn('[license] Background refresh failed:', err?.message || err);
    });
  }, REFRESH_INTERVAL_MS);
}

function registerLicenseIpc(ipcMain) {
  console.log('[license] Blank Discord bot license API');

  ipcMain.handle('nova-license-hardware', async () => {
    const hw = await getHardwareFingerprint();
    return { ok: true, deviceId: hw.deviceId, hardwareId: hw.hardwareId };
  });

  ipcMain.handle('get-hwid', async () => {
    const hw = await getHardwareFingerprint();
    return hw.hardwareId;
  });

  ipcMain.handle('get-session', async () => loadSessionRecord() || {});

  ipcMain.handle('save-session', async (_e, data) => {
    const payload = data && typeof data === 'object' ? data : {};
    if (payload.authenticated && payload.licenseKey) {
      persistSuccessfulSession(payload.licenseKey);
    } else {
      saveSessionRecord(payload);
    }
    return { ok: true };
  });

  ipcMain.handle('nova-license-status', async () => refreshStoredSession());

  ipcMain.handle('nova-license-redeem', async (_e, licenseKey) => redeemLicense(licenseKey));

  ipcMain.handle('nova-license-validate', async (_e, licenseKey) => validateLicense(licenseKey));

  ipcMain.handle('verify-license-key', async (_e, key) => verifyLicenseKeyInMain(String(key || '')));

  ipcMain.handle('nova-license-clear', async () => {
    clearLicenseSession();
    return { ok: true };
  });

  refreshStoredSession().catch(() => {});
  startLicenseRefreshLoop();
}

module.exports = {
  registerLicenseIpc,
  getHardwareFingerprint,
  redeemLicense,
  validateLicense,
  getLicenseStatus,
  refreshStoredSession,
  clearLicenseSession,
  formatDeviceId,
};
