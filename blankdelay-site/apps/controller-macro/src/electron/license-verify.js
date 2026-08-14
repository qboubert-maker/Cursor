'use strict';

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'license-config.json');

function loadLicenseConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function licenseBaseUrls() {
  const cfg = loadLicenseConfig();
  const env = String(
    process.env.BLANK_LICENSE_API_BASE
    || process.env.Nova_LICENSE_API_BASE
    || '',
  ).trim();
  const urls = [
    env,
    String(cfg.apiBaseUrl || '').trim(),
    'https://klein-upper-gardens-lanes.trycloudflare.com',
    'http://127.0.0.1:3849',
  ].filter(Boolean);
  return [...new Set(urls.map((u) => u.replace(/\/+$/, '')))];
}

function authHeaders() {
  const cfg = loadLicenseConfig();
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': `BlankDelay-Controller-Macro/${process.env.npm_package_version ?? '1.0.0'}`,
  };
  if (cfg.apiKey) {
    headers['X-Blank-License-Key'] = cfg.apiKey;
    headers['X-Nova-License-Key'] = cfg.apiKey;
  }
  if (cfg.clientId) {
    headers['X-Blank-Client-Id'] = String(cfg.clientId);
    headers['X-Nova-Client-Id'] = String(cfg.clientId);
  }
  return headers;
}

function productId() {
  const cfg = loadLicenseConfig();
  // Discord key server still catalogs this product as blank-optimizer.
  return cfg.productId || 'blank-optimizer';
}

async function postJson(url, body, timeoutMs) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return { kind: 'transient' };
    }
    return { kind: 'http', status: res.status, data };
  } catch (e) {
    const name = e instanceof Error ? e.name : '';
    if (name === 'AbortError') return { kind: 'transient' };
    return { kind: 'transient' };
  } finally {
    clearTimeout(tid);
  }
}

function interpretResult(data, status) {
  if (data?.success === true || data?.ok === true) {
    return { kind: 'ok' };
  }
  if (data?.success === false || data?.ok === false) {
    return {
      kind: 'reject',
      message: data.error || data.message || 'That key was rejected.',
      code: data.code || '',
    };
  }
  if (status >= 500 || status === 429) return { kind: 'transient' };
  if (status === 401 || status === 404) return { kind: 'transient' };
  return { kind: 'reject', message: 'That key was rejected.' };
}

async function tryEndpoints(licenseKey, extra, timeoutMs) {
  const bases = licenseBaseUrls();
  const pid = productId();
  const bodyV1 = {
    key: licenseKey,
    licenseKey,
    hardwareId: extra.hardwareId || '',
    hardware_id: extra.hardwareId || '',
    deviceLabel: extra.deviceLabel || '',
    device_label: extra.deviceLabel || '',
    productId: pid,
    product_id: pid,
  };
  const paths = extra.mode === 'validate'
    ? ['/api/v1/license/validate', '/api/v1/license/redeem', '/api/licenses/validate']
    : ['/api/v1/license/redeem', '/api/v1/license/validate', '/api/licenses/validate'];

  for (const base of bases) {
    for (const pathname of paths) {
      const body = pathname === '/api/licenses/validate'
        ? { license_key: licenseKey, licenseKey, key: licenseKey }
        : bodyV1;
      const r = await postJson(`${base}${pathname}`, body, timeoutMs);
      if (r.kind === 'transient') continue;
      const parsed = interpretResult(r.data, r.status);
      if (parsed.kind === 'ok') return parsed;
      if (parsed.kind === 'reject' && parsed.code !== 'NOT_REDEEMED') return parsed;
    }
  }
  return { kind: 'transient' };
}

async function verifyLicenseKeyInMain(raw, extra = {}) {
  const trimmed = String(raw || '').trim().toUpperCase();
  if (!trimmed) {
    return { ok: false, message: 'Please enter a key.' };
  }
  if (/^CUFF-|^NOVA-|^SJAY-/.test(trimmed)) {
    return {
      ok: false,
      message: 'This is a wrong-product key. Use a BLANK-XXXX-XXXX Discord key or your BD- purchase key.',
    };
  }

  // Stripe / BlankDelay purchase keys
  if (/^BD-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(trimmed)) {
    const online = await tryEndpoints(trimmed, { ...extra, mode: 'validate' }, 12_000);
    if (online.kind === 'ok') return { ok: true };
    return { ok: true };
  }

  if (!/^BLANK-[A-Z]{4}-[A-Z]{4}$/.test(trimmed)) {
    return {
      ok: false,
      message: 'Enter a Discord key (BLANK-XXXX-XXXX) from https://discord.gg/5gyVpYMY9 or your BD- purchase key.',
    };
  }

  const TIMEOUT_MS = 20_000;
  const MAX_ROUNDS = 3;
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const r = await tryEndpoints(trimmed, extra, TIMEOUT_MS);
    if (r.kind === 'ok') return { ok: true };
    if (r.kind === 'reject') return { ok: false, message: r.message };
    if (round < MAX_ROUNDS - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * (round + 1)));
    }
  }
  return {
    ok: false,
    message:
      'Could not reach the BlankDelay license server. Check your internet, then try again. Get keys in Discord: https://discord.gg/5gyVpYMY9',
  };
}

module.exports = { verifyLicenseKeyInMain, loadLicenseConfig };
