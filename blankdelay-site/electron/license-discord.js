'use strict';

/**
 * Discord-linked license validation shared by all BlankDelay desktop products.
 * Uses the same Blank license API the Controller Macro (Blank Optimizer) uses.
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'license-config.json');
const BD_KEY_RE = /^BD-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const BLANK_KEY_RE = /^BLANK-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function loadLicenseConfig() {
    try {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf8').replace(/^\uFEFF/, '');
        return JSON.parse(raw);
    } catch {
        return {
            clientId: '1537215181803880518',
            apiKey: 'cl487rx9mvqh5z3jd2g1oeys6aiktupb0fnw',
            apiBaseUrl: 'https://klein-upper-gardens-lanes.trycloudflare.com',
            productId: 'blank-optimizer',
            discordInvite: 'https://discord.gg/5gyVpYMY9'
        };
    }
}

function licenseBaseUrls() {
    const cfg = loadLicenseConfig();
    const env = String(process.env.BLANK_LICENSE_API_BASE || '').trim();
    return [...new Set([
        env,
        String(cfg.apiBaseUrl || '').trim(),
        'https://klein-upper-gardens-lanes.trycloudflare.com',
        'http://127.0.0.1:3849'
    ].filter(Boolean).map((u) => u.replace(/\/+$/, '')))];
}

function authHeaders() {
    const cfg = loadLicenseConfig();
    const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'BlankDelay-Desktop/2.0.0'
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

async function postJson(url, body, timeoutMs) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(body),
            signal: controller.signal
        });
        const text = await res.text();
        let data = {};
        try { data = text ? JSON.parse(text) : {}; } catch { return { kind: 'transient' }; }
        return { kind: 'http', status: res.status, data };
    } catch {
        return { kind: 'transient' };
    } finally {
        clearTimeout(tid);
    }
}

function interpretResult(data, status) {
    if (data?.success === true || data?.ok === true) return { kind: 'ok' };
    if (data?.success === false || data?.ok === false) {
        return {
            kind: 'reject',
            message: data.error || data.message || 'That key was rejected.',
            code: data.code || ''
        };
    }
    if (status >= 500 || status === 429 || status === 401 || status === 404) return { kind: 'transient' };
    return { kind: 'reject', message: 'That key was rejected.' };
}

async function tryEndpoints(licenseKey, productId, timeoutMs) {
    const cfg = loadLicenseConfig();
    const pid = productId || cfg.productId || 'blank-optimizer';
    const bodyV1 = {
        key: licenseKey,
        licenseKey,
        productId: pid,
        product_id: pid
    };
    const paths = ['/api/v1/license/validate', '/api/v1/license/redeem', '/api/licenses/validate'];
    for (const base of licenseBaseUrls()) {
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

/**
 * Validate a key for a BlankDelay product.
 * - BLANK-XXXX-XXXX → Discord API when listed; otherwise accepted as purchase key (offline OK)
 * - BD-XXXX-XXXX-XXXX → Stripe / purchase keys (API first, then offline accept)
 */
async function validateDiscordLinkedKey(raw, productKey) {
    const key = String(raw || '').trim().toUpperCase();
    const invite = loadLicenseConfig().discordInvite || 'https://discord.gg/5gyVpYMY9';
    if (!key) return { valid: false, msg: 'Please enter a key.' };

    if (/^CUFF-|^NOVA-|^SJAY-/.test(key)) {
        return { valid: false, msg: 'Wrong-product key. Use a BLANK-XXXX-XXXX key.' };
    }

    const productMap = {
        controller: 'blank-optimizer',
        keyboard: 'blank-optimizer',
        premium: 'blank-optimizer',
        zero: 'blank-optimizer',
        'zero-plus': 'blank-optimizer',
        fps: 'blank-optimizer',
        ping: 'blank-optimizer',
        aim: 'blank-optimizer',
        shotgun: 'blank-optimizer'
    };
    const pid = productMap[productKey] || 'blank-optimizer';

    if (BLANK_KEY_RE.test(key)) {
        // Prefer Discord stock when the key is registered online.
        for (let round = 0; round < 2; round += 1) {
            const r = await tryEndpoints(key, pid, 12000);
            if (r.kind === 'ok') return { valid: true, msg: 'License activated via Discord.' };
            if (r.kind === 'reject') break;
            await new Promise((res) => setTimeout(res, 800 * (round + 1)));
        }
        // Hub / store purchase keys use the same BLANK-XXXX-XXXX shape and work offline.
        return { valid: true, msg: 'License activated.' };
    }

    if (BD_KEY_RE.test(key)) {
        const online = await tryEndpoints(key, pid, 10000);
        if (online.kind === 'ok') return { valid: true, msg: 'License activated.' };
        // Purchase keys remain usable if Discord API does not list them yet.
        return { valid: true, msg: 'License activated.' };
    }

    return {
        valid: false,
        msg: `Enter a key in BLANK-XXXX-XXXX format (get one at ${invite} or from your purchase email).`
    };
}

module.exports = { validateDiscordLinkedKey, loadLicenseConfig };
