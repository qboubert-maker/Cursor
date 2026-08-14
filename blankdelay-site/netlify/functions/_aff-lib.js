'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/** Affiliate keeps 80% of attributed sales; owner share is 20%. */
const AFFILIATE_RATE = Number(process.env.AFFILIATE_COMMISSION_RATE || 0.8);
const OWNER_RATE = Number(process.env.OWNER_SALE_SHARE || 0.2);
/** On cash-out, 20% of the withdrawn balance goes to the owner. */
const CASHOUT_FEE_RATE = Number(process.env.CASHOUT_FEE_RATE || 0.2);

const FILE_FALLBACK = process.env.AFFILIATE_DATA_PATH
  || path.join('/tmp', 'blankdelay-affiliates.json');

function emptyState() {
  return {
    users: [],
    clicks: {},
    sales: [],
    payouts: [],
    ownerLedger: { cashoutFees: 0, saleShare: 0 },
    resetTokens: {},
    updatedAt: Date.now()
  };
}

function hashPassword(password, salt) {
  const useSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), useSalt, 64).toString('hex');
  return { salt: useSalt, hash };
}

function verifyPassword(password, user) {
  if (!user || !user.passwordHash || !user.passwordSalt) return false;
  const { hash } = hashPassword(password, user.passwordSalt);
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.passwordHash, 'hex'));
  } catch {
    return false;
  }
}

function publicUser(u) {
  if (!u) return null;
  return {
    email: u.email,
    code: u.code,
    earnings: Number(u.earnings || 0),
    paidOut: Number(u.paidOut || 0),
    balance: +(Number(u.earnings || 0) - Number(u.paidOut || 0)).toFixed(2),
    sales: Number(u.sales || 0),
    clicks: Number(u.clicks || 0),
    ownerShare: Number(u.ownerShare || 0),
    paypalEmail: u.paypalEmail || '',
    created: u.created || 0
  };
}

function adminUser(u, sales) {
  const pub = publicUser(u);
  return {
    ...pub,
    // Never expose password hashes or plaintext passwords.
    passwordStored: Boolean(u.passwordHash),
    recentSales: (sales || [])
      .filter((s) => s.code === u.code)
      .slice(-30)
      .reverse()
  };
}

let blobsStore = null;
async function getBlobsStore() {
  if (blobsStore) return blobsStore;
  try {
    const { getStore } = require('@netlify/blobs');
    blobsStore = getStore({ name: 'blankdelay-affiliates', consistency: 'strong' });
    return blobsStore;
  } catch {
    return null;
  }
}

async function readState() {
  const store = await getBlobsStore();
  if (store) {
    try {
      const data = await store.get('state', { type: 'json' });
      if (data && Array.isArray(data.users)) return data;
    } catch {
      /* fall through */
    }
  }
  try {
    if (fs.existsSync(FILE_FALLBACK)) {
      const raw = JSON.parse(fs.readFileSync(FILE_FALLBACK, 'utf8'));
      if (raw && Array.isArray(raw.users)) return raw;
    }
  } catch {
    /* ignore */
  }
  return emptyState();
}

async function writeState(state) {
  state.updatedAt = Date.now();
  const store = await getBlobsStore();
  if (store) {
    await store.setJSON('state', state);
  }
  try {
    fs.mkdirSync(path.dirname(FILE_FALLBACK), { recursive: true });
    fs.writeFileSync(FILE_FALLBACK, JSON.stringify(state, null, 2));
  } catch {
    /* /tmp may be unavailable in some runtimes; blobs still persist */
  }
  return state;
}

function makeCode() {
  return 'AFF-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

function makeToken() {
  return crypto.randomBytes(24).toString('hex');
}

function adminTokenOk(headerToken, bodyToken) {
  const expected = String(process.env.AFFILIATE_ADMIN_TOKEN || '').trim();
  if (!expected) return false;
  const got = String(headerToken || bodyToken || '').trim();
  if (!got || got.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  } catch {
    return false;
  }
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-BD-Admin-Token, X-BD-Aff-Token',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };
}

function json(statusCode, body, origin) {
  return {
    statusCode,
    headers: corsHeaders(origin),
    body: JSON.stringify(body)
  };
}

module.exports = {
  AFFILIATE_RATE,
  OWNER_RATE,
  CASHOUT_FEE_RATE,
  emptyState,
  hashPassword,
  verifyPassword,
  publicUser,
  adminUser,
  readState,
  writeState,
  makeCode,
  makeToken,
  adminTokenOk,
  json,
  corsHeaders
};
