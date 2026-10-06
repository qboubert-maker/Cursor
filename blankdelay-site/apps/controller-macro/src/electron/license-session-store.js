'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

const FILE_NAME = 'sjay-license-session.dat';
const LEGACY_FILE_NAMES = ['cuff-license-session.dat', 'aphrodite-license-session.dat'];

function getStorePath() {
  return path.join(app.getPath('userData'), FILE_NAME);
}

function getLegacyStorePaths() {
  const dir = app.getPath('userData');
  return LEGACY_FILE_NAMES.map((name) => path.join(dir, name));
}

function canEncrypt() {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function encryptPayload(text) {
  if (canEncrypt()) {
    return { v: 2, enc: safeStorage.encryptString(text).toString('base64') };
  }
  return { v: 1, raw: text };
}

function decryptPayload(parsed) {
  if (!parsed) return null;
  if (parsed.v === 2 && parsed.enc) {
    if (!canEncrypt()) return null;
    return safeStorage.decryptString(Buffer.from(parsed.enc, 'base64'));
  }
  if (parsed.v === 1 && parsed.raw) return parsed.raw;
  return null;
}

function readSessionFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const raw = decryptPayload(parsed.payload);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadSessionRecord() {
  const primary = readSessionFile(getStorePath());
  if (primary) return primary;
  for (const legacy of getLegacyStorePaths()) {
    const record = readSessionFile(legacy);
    if (record) {
      try { saveSessionRecord(record); } catch { /* ignore migrate write */ }
      return record;
    }
  }
  return null;
}

function saveSessionRecord(record) {
  const filePath = getStorePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const payload = encryptPayload(JSON.stringify(record));
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ payload }, null, 2));
  fs.renameSync(tmp, filePath);
}

function clearSessionRecord() {
  try {
    const paths = [getStorePath(), ...getLegacyStorePaths()];
    for (const filePath of paths) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  } catch {
    /* ignore */
  }
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

module.exports = {
  loadSessionRecord,
  saveSessionRecord,
  clearSessionRecord,
  hashToken,
};
