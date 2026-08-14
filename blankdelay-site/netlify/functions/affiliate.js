'use strict';

const {
  AFFILIATE_RATE,
  OWNER_RATE,
  CASHOUT_FEE_RATE,
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
} = require('./_aff-lib');

function sessionTokenFor(user) {
  // Lightweight session: email + code + created signature (not a full JWT).
  const payload = `${user.email}|${user.code}|${user.created || 0}`;
  const sig = require('crypto')
    .createHmac('sha256', process.env.AFFILIATE_ADMIN_TOKEN || 'blankdelay-aff-session')
    .update(payload)
    .digest('hex')
    .slice(0, 32);
  return Buffer.from(`${payload}|${sig}`).toString('base64url');
}

function userFromSession(state, token) {
  if (!token) return null;
  try {
    const raw = Buffer.from(String(token), 'base64url').toString('utf8');
    const parts = raw.split('|');
    if (parts.length < 4) return null;
    const [email, code, created, sig] = parts;
    const payload = `${email}|${code}|${created}`;
    const expect = require('crypto')
      .createHmac('sha256', process.env.AFFILIATE_ADMIN_TOKEN || 'blankdelay-aff-session')
      .update(payload)
      .digest('hex')
      .slice(0, 32);
    if (sig !== expect) return null;
    return state.users.find((u) => u.email === email && u.code === code) || null;
  } catch {
    return null;
  }
}

function findByEmail(state, email) {
  const e = String(email || '').trim().toLowerCase();
  return state.users.find((u) => u.email === e) || null;
}

function findByCode(state, code) {
  const c = String(code || '').trim().toUpperCase();
  return state.users.find((u) => u.code === c) || null;
}

async function creditSale(state, { code, amount, product, orderId }) {
  const user = findByCode(state, code);
  if (!user) return { ok: false, msg: 'Unknown affiliate code.' };
  const saleAmount = Math.max(0, Number(amount) || 0);
  if (saleAmount <= 0) return { ok: false, msg: 'Invalid amount.' };
  if (orderId && state.sales.some((s) => s.orderId && s.orderId === orderId)) {
    return { ok: true, duplicate: true };
  }
  const commission = +(saleAmount * AFFILIATE_RATE).toFixed(2);
  const ownerShare = +(saleAmount * OWNER_RATE).toFixed(2);
  user.earnings = +(Number(user.earnings || 0) + commission).toFixed(2);
  user.sales = Number(user.sales || 0) + 1;
  user.ownerShare = +(Number(user.ownerShare || 0) + ownerShare).toFixed(2);
  state.ownerLedger.saleShare = +(Number(state.ownerLedger.saleShare || 0) + ownerShare).toFixed(2);
  state.sales.push({
    id: makeToken().slice(0, 12),
    code: user.code,
    email: user.email,
    amount: saleAmount,
    commission,
    ownerShare,
    product: product || 'BlankDelay Product',
    orderId: orderId || '',
    date: Date.now()
  });
  await writeState(state);
  return { ok: true, commission, ownerShare };
}

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin || '*';
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(origin), body: '' };
  }

  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      return json(400, { ok: false, msg: 'Invalid JSON' }, origin);
    }
  }

  const action = String(body.action || event.queryStringParameters?.action || '').trim();
  const adminHdr = event.headers['x-bd-admin-token'] || event.headers['X-BD-Admin-Token'];
  const affHdr = event.headers['x-bd-aff-token'] || event.headers['X-BD-Aff-Token'];

  try {
    const state = await readState();

    if (action === 'signup') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!email || !email.includes('@')) return json(400, { ok: false, msg: 'Valid email required.' }, origin);
      if (password.length < 6) return json(400, { ok: false, msg: 'Password must be at least 6 characters.' }, origin);
      if (findByEmail(state, email)) return json(409, { ok: false, msg: 'Email already registered.' }, origin);
      const { salt, hash } = hashPassword(password);
      const user = {
        email,
        passwordHash: hash,
        passwordSalt: salt,
        code: makeCode(),
        earnings: 0,
        paidOut: 0,
        sales: 0,
        clicks: 0,
        ownerShare: 0,
        paypalEmail: '',
        created: Date.now()
      };
      state.users.push(user);
      await writeState(state);
      return json(200, {
        ok: true,
        user: publicUser(user),
        token: sessionTokenFor(user),
        rates: { affiliate: AFFILIATE_RATE, owner: OWNER_RATE, cashoutFee: CASHOUT_FEE_RATE }
      }, origin);
    }

    if (action === 'login') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const user = findByEmail(state, email);
      if (!user || !verifyPassword(password, user)) {
        return json(401, { ok: false, msg: 'Invalid email or password.' }, origin);
      }
      return json(200, {
        ok: true,
        user: publicUser({ ...user, clicks: user.clicks || state.clicks[user.code] || 0 }),
        token: sessionTokenFor(user),
        rates: { affiliate: AFFILIATE_RATE, owner: OWNER_RATE, cashoutFee: CASHOUT_FEE_RATE }
      }, origin);
    }

    if (action === 'click') {
      const code = String(body.code || '').trim().toUpperCase();
      const user = findByCode(state, code);
      if (!user) return json(404, { ok: false, msg: 'Unknown affiliate link.' }, origin);
      state.clicks[code] = Number(state.clicks[code] || 0) + 1;
      user.clicks = state.clicks[code];
      await writeState(state);
      return json(200, { ok: true, clicks: user.clicks }, origin);
    }

    if (action === 'me') {
      const user = userFromSession(state, body.token || affHdr);
      if (!user) return json(401, { ok: false, msg: 'Not logged in.' }, origin);
      const clicks = Number(state.clicks[user.code] || user.clicks || 0);
      const sales = state.sales.filter((s) => s.code === user.code).slice(-40).reverse();
      const pendingPayouts = state.payouts.filter((p) => p.email === user.email && p.status === 'pending');
      return json(200, {
        ok: true,
        user: publicUser({ ...user, clicks }),
        sales,
        pendingPayouts,
        rates: { affiliate: AFFILIATE_RATE, owner: OWNER_RATE, cashoutFee: CASHOUT_FEE_RATE }
      }, origin);
    }

    if (action === 'cashout') {
      const user = userFromSession(state, body.token || affHdr);
      if (!user) return json(401, { ok: false, msg: 'Not logged in.' }, origin);
      const paypalEmail = String(body.paypalEmail || user.paypalEmail || user.email).trim().toLowerCase();
      const balance = +(Number(user.earnings || 0) - Number(user.paidOut || 0)).toFixed(2);
      const amount = body.amount != null ? Number(body.amount) : balance;
      if (!paypalEmail.includes('@')) return json(400, { ok: false, msg: 'PayPal email required.' }, origin);
      if (!(amount >= 5)) return json(400, { ok: false, msg: 'Minimum cash-out is $5.00.' }, origin);
      if (amount > balance + 0.001) return json(400, { ok: false, msg: 'Amount exceeds available balance.' }, origin);
      const fee = +(amount * CASHOUT_FEE_RATE).toFixed(2);
      const net = +(amount - fee).toFixed(2);
      user.paypalEmail = paypalEmail;
      user.paidOut = +(Number(user.paidOut || 0) + amount).toFixed(2);
      state.ownerLedger.cashoutFees = +(Number(state.ownerLedger.cashoutFees || 0) + fee).toFixed(2);
      const payout = {
        id: 'PO-' + makeToken().slice(0, 10).toUpperCase(),
        email: user.email,
        code: user.code,
        amount,
        fee,
        net,
        paypalEmail,
        status: 'pending',
        date: Date.now()
      };
      state.payouts.push(payout);
      await writeState(state);
      return json(200, {
        ok: true,
        payout,
        user: publicUser(user),
        msg: `Cash-out requested. You receive $${net.toFixed(2)} after the 20% owner fee ($${fee.toFixed(2)}).`
      }, origin);
    }

    if (action === 'forgot') {
      const email = String(body.email || '').trim().toLowerCase();
      const user = findByEmail(state, email);
      // Always return ok to avoid email enumeration.
      if (!user) return json(200, { ok: true, msg: 'If that email is registered, a reset link is ready.' }, origin);
      const token = makeToken();
      state.resetTokens[token] = {
        email: user.email,
        expires: Date.now() + 60 * 60 * 1000
      };
      await writeState(state);
      const base = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://blankdelay.com';
      const resetUrl = `${String(base).replace(/\/$/, '')}/index.html?aff_reset=${encodeURIComponent(token)}#specials`;
      return json(200, {
        ok: true,
        msg: 'Password reset ready. Use the link (valid 1 hour).',
        // Returned so the site can show it to the user immediately if email is not wired yet.
        resetUrl
      }, origin);
    }

    if (action === 'reset') {
      const token = String(body.token || '').trim();
      const password = String(body.password || '');
      const entry = state.resetTokens[token];
      if (!entry || entry.expires < Date.now()) {
        return json(400, { ok: false, msg: 'Reset link expired or invalid.' }, origin);
      }
      if (password.length < 6) return json(400, { ok: false, msg: 'Password must be at least 6 characters.' }, origin);
      const user = findByEmail(state, entry.email);
      if (!user) return json(404, { ok: false, msg: 'Account not found.' }, origin);
      const { salt, hash } = hashPassword(password);
      user.passwordHash = hash;
      user.passwordSalt = salt;
      delete state.resetTokens[token];
      await writeState(state);
      return json(200, { ok: true, msg: 'Password updated. You can log in now.' }, origin);
    }

    if (action === 'credit') {
      // Internal / webhook / admin credit
      const isAdmin = adminTokenOk(adminHdr, body.adminToken);
      const secret = String(process.env.AFFILIATE_INTERNAL_SECRET || process.env.AFFILIATE_ADMIN_TOKEN || '').trim();
      const internalOk = secret && String(body.internalSecret || '') === secret;
      if (!isAdmin && !internalOk) return json(401, { ok: false, msg: 'Unauthorized' }, origin);
      const result = await creditSale(state, {
        code: body.code,
        amount: body.amount,
        product: body.product,
        orderId: body.orderId
      });
      return json(result.ok ? 200 : 400, result, origin);
    }

    if (action === 'admin_overview') {
      if (!adminTokenOk(adminHdr, body.adminToken)) {
        const configured = Boolean(String(process.env.AFFILIATE_ADMIN_TOKEN || '').trim());
        return json(401, {
          ok: false,
          msg: configured
            ? 'Invalid owner token.'
            : 'Set AFFILIATE_ADMIN_TOKEN in Netlify env vars first.'
        }, origin);
      }
      const users = state.users.map((u) => {
        const clicks = Number(state.clicks[u.code] || u.clicks || 0);
        return adminUser({ ...u, clicks }, state.sales);
      });
      const pendingPayouts = state.payouts.filter((p) => p.status === 'pending');
      const paidPayouts = state.payouts.filter((p) => p.status === 'paid');
      const totalAffiliateEarnings = users.reduce((s, u) => s + Number(u.earnings || 0), 0);
      const totalOwnerFromSales = Number(state.ownerLedger.saleShare || 0);
      const totalOwnerFromCashoutFees = Number(state.ownerLedger.cashoutFees || 0);
      return json(200, {
        ok: true,
        rates: { affiliate: AFFILIATE_RATE, owner: OWNER_RATE, cashoutFee: CASHOUT_FEE_RATE },
        summary: {
          affiliates: users.length,
          totalClicks: Object.values(state.clicks).reduce((a, b) => a + Number(b || 0), 0),
          totalSales: state.sales.length,
          totalAffiliateEarnings: +totalAffiliateEarnings.toFixed(2),
          yourShareFromSales: +totalOwnerFromSales.toFixed(2),
          yourCashoutFees: +totalOwnerFromCashoutFees.toFixed(2),
          yourTotal: +(totalOwnerFromSales + totalOwnerFromCashoutFees).toFixed(2)
        },
        users,
        sales: state.sales.slice().reverse().slice(0, 100),
        pendingPayouts,
        paidPayouts: paidPayouts.slice().reverse().slice(0, 50)
      }, origin);
    }

    if (action === 'admin_create') {
      if (!adminTokenOk(adminHdr, body.adminToken)) return json(401, { ok: false, msg: 'Unauthorized' }, origin);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || makeToken().slice(0, 10));
      if (!email.includes('@')) return json(400, { ok: false, msg: 'Valid email required.' }, origin);
      if (findByEmail(state, email)) return json(409, { ok: false, msg: 'Email already registered.' }, origin);
      const { salt, hash } = hashPassword(password);
      const user = {
        email,
        passwordHash: hash,
        passwordSalt: salt,
        code: makeCode(),
        earnings: 0,
        paidOut: 0,
        sales: 0,
        clicks: 0,
        ownerShare: 0,
        paypalEmail: '',
        created: Date.now()
      };
      state.users.push(user);
      await writeState(state);
      // One-time temp password returned ONLY to the owner at create time (not stored in plaintext).
      return json(200, {
        ok: true,
        user: publicUser(user),
        temporaryPassword: password,
        msg: 'Affiliate created. Share the temporary password once — it cannot be viewed again. They can use Forgot password anytime.'
      }, origin);
    }

    if (action === 'admin_reset_link') {
      if (!adminTokenOk(adminHdr, body.adminToken)) return json(401, { ok: false, msg: 'Unauthorized' }, origin);
      const email = String(body.email || '').trim().toLowerCase();
      const user = findByEmail(state, email);
      if (!user) return json(404, { ok: false, msg: 'Affiliate not found.' }, origin);
      const token = makeToken();
      state.resetTokens[token] = { email: user.email, expires: Date.now() + 60 * 60 * 1000 };
      await writeState(state);
      const base = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://blankdelay.com';
      const resetUrl = `${String(base).replace(/\/$/, '')}/index.html?aff_reset=${encodeURIComponent(token)}#specials`;
      return json(200, { ok: true, email: user.email, resetUrl }, origin);
    }

    if (action === 'admin_mark_paid') {
      if (!adminTokenOk(adminHdr, body.adminToken)) return json(401, { ok: false, msg: 'Unauthorized' }, origin);
      const payout = state.payouts.find((p) => p.id === body.payoutId);
      if (!payout) return json(404, { ok: false, msg: 'Payout not found.' }, origin);
      payout.status = 'paid';
      payout.paidAt = Date.now();
      await writeState(state);
      return json(200, { ok: true, payout }, origin);
    }

    return json(400, { ok: false, msg: 'Unknown action.' }, origin);
  } catch (err) {
    console.error('affiliate api error', err);
    return json(500, { ok: false, msg: err.message || 'Server error' }, origin);
  }
};

// Exported for webhook reuse
exports.creditSaleFromWebhook = async (opts) => {
  const state = await readState();
  return creditSale(state, opts);
};
