/* BlankDelay live affiliate registry (shared across all browsers via Netlify Blobs) */
const crypto = require("crypto");
const {
  getAffiliateStore,
  loadAffiliateState,
  saveAffiliateState,
  upsertAffiliateUser,
  publicUser,
  findAffiliateByEmail,
  findAffiliateByCode,
  normalizeCode,
  bumpClick,
  withStateRetry,
} = require("../lib/affiliate-store");
const { applyPendingForCode, creditFromCheckoutSession } = require("../lib/affiliate-credit");

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password || ""), "utf8").digest("hex");
}

function makeCode(state) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 30; attempt++) {
    let code = "";
    for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (!findAffiliateByCode(state, code)) return code;
  }
  return "A" + Date.now().toString(36).toUpperCase().slice(-5);
}

function json(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  let store;
  try {
    store = await getAffiliateStore(event);
  } catch (err) {
    return json(200, {
      ok: false,
      msg: "Affiliate store unavailable",
      detail: String(err && err.message),
    });
  }

  let state;
  try {
    state = await loadAffiliateState(store);
  } catch (err) {
    return json(200, {
      ok: false,
      msg: "Could not read affiliate registry",
      detail: String(err && err.message),
    });
  }

  const qs = event.queryStringParameters || {};

  if (event.httpMethod === "GET") {
    const users = (state.users || []).map(publicUser);
    return json(200, {
      ok: true,
      live: true,
      userCount: users.length,
      users,
      clicks: state.clicks || {},
      sales: state.sales || [],
      cashouts: state.cashouts || [],
      creditedSessions: state.creditedSessions || [],
      pendingByCode: state.pendingByCode || [],
    });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, msg: "Method not allowed" });
  }

  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch (_) {
    return json(400, { ok: false, msg: "Invalid JSON" });
  }

  const action = body.action || qs.action || "";

  try {
    if (action === "register") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!email || !email.includes("@")) {
        return json(200, { ok: false, msg: "Valid email required." });
      }
      if (password.length < 6) {
        return json(200, { ok: false, msg: "Password must be at least 6 characters." });
      }
      if (email === "qboubert@gmail.com") {
        return json(200, { ok: false, msg: "That email is reserved." });
      }
      const existing = findAffiliateByEmail(state, email);
      if (existing) {
        return json(200, { ok: false, msg: "Email already registered." });
      }
      const code = normalizeCode(body.code) || makeCode(state);
      let user = upsertAffiliateUser(state, {
        email,
        code,
        passwordHash: hashPassword(password),
        earnings: 0,
        sales: 0,
        paidOut: 0,
        created: Date.now(),
        lastSeen: Date.now(),
      });
      user = applyPendingForCode(state, user);
      upsertAffiliateUser(state, user);
      await saveAffiliateState(store, state);
      return json(200, { ok: true, user: publicUser(user), userCount: state.users.length });
    }

    if (action === "login") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      let user = findAffiliateByEmail(state, email);
      if (!user || !user.passwordHash || user.passwordHash !== hashPassword(password)) {
        return json(200, { ok: false, msg: "Invalid email or password." });
      }
      user.lastSeen = Date.now();
      user = applyPendingForCode(state, user);
      upsertAffiliateUser(state, user);
      await saveAffiliateState(store, state);
      return json(200, { ok: true, user: publicUser(user) });
    }

    if (action === "upsert" && body.user) {
      const incoming = { ...body.user };
      if (body.password) incoming.passwordHash = hashPassword(body.password);
      incoming.lastSeen = Date.now();
      if (incoming.code) incoming.code = normalizeCode(incoming.code) || incoming.code;
      let user = upsertAffiliateUser(state, incoming);
      user = applyPendingForCode(state, user);
      upsertAffiliateUser(state, user);
      await saveAffiliateState(store, state);
      return json(200, { ok: true, user: publicUser(user), userCount: state.users.length });
    }

    if (action === "credit-from-session") {
      const sessionId = String(body.session_id || body.sessionId || "").trim();
      const stripeSecret = process.env.STRIPE_SECRET_KEY;
      if (!sessionId) {
        return json(200, { ok: false, msg: "session_id required" });
      }
      if (!stripeSecret) {
        return json(200, { ok: false, msg: "STRIPE_SECRET_KEY missing" });
      }
      const result = await creditFromCheckoutSession(event, sessionId, stripeSecret);
      return json(200, result);
    }

    if (action === "health") {
      return json(200, {
        ok: true,
        live: true,
        userCount: state.users.length,
        clickCodes: Object.keys(state.clicks || {}).length,
        sales: (state.sales || []).length,
        pending: (state.pendingByCode || []).length,
      });
    }

    if (action === "click" && body.code) {
      const clicks = await withStateRetry(store, (s) => {
        const n = bumpClick(s, body.code);
        return { ok: true, clicks: n, code: normalizeCode(body.code) };
      });
      return json(200, clicks);
    }

    if (action === "sale" && body.sale) {
      if (body.sale.code) body.sale.code = normalizeCode(body.sale.code) || body.sale.code;
      state.sales.push(body.sale);
      if (body.user) upsertAffiliateUser(state, body.user);
      await saveAffiliateState(store, state);
      return json(200, { ok: true, userCount: state.users.length });
    }

    if (action === "cashout" && body.cashout) {
      const id = body.cashout.id;
      const idx = state.cashouts.findIndex((c) => c.id === id);
      if (idx >= 0) state.cashouts[idx] = body.cashout;
      else state.cashouts.push(body.cashout);
      await saveAffiliateState(store, state);
      return json(200, { ok: true });
    }

    if (action === "cashout-paid" && body.cashout) {
      const id = body.cashout.id;
      const idx = state.cashouts.findIndex((c) => c.id === id);
      if (idx >= 0) state.cashouts[idx] = { ...state.cashouts[idx], ...body.cashout };
      else state.cashouts.push(body.cashout);
      await saveAffiliateState(store, state);
      return json(200, { ok: true });
    }

    if (action === "list" || action === "snapshot") {
      return json(200, {
        ok: true,
        live: true,
        userCount: state.users.length,
        users: state.users.map(publicUser),
        clicks: state.clicks || {},
        sales: state.sales || [],
        cashouts: state.cashouts || [],
        pendingByCode: state.pendingByCode || [],
      });
    }

    return json(400, { ok: false, msg: "Unknown action" });
  } catch (err) {
    console.error("affiliate-api error:", err);
    return json(200, { ok: false, msg: err.message || "Affiliate API error" });
  }
};
