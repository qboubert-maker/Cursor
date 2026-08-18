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
} = require("../lib/affiliate-store");

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

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  let store;
  try {
    store = getAffiliateStore(event);
  } catch (err) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: false,
        msg: "Affiliate store unavailable",
        detail: String(err && err.message),
      }),
    };
  }

  let state;
  try {
    state = await loadAffiliateState(store);
  } catch (err) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: false, msg: "Could not read affiliate registry", detail: String(err && err.message) }),
    };
  }

  const qs = event.queryStringParameters || {};

  if (event.httpMethod === "GET") {
    const users = (state.users || []).map(publicUser);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        live: true,
        userCount: users.length,
        users,
        clicks: state.clicks || {},
        sales: state.sales || [],
        cashouts: state.cashouts || [],
        creditedSessions: state.creditedSessions || [],
      }),
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, msg: "Method not allowed" }) };
  }

  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch (_) {
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, msg: "Invalid JSON" }) };
  }

  const action = body.action || qs.action || "";

  try {
    if (action === "register") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!email || !email.includes("@")) {
        return { statusCode: 200, headers, body: JSON.stringify({ ok: false, msg: "Valid email required." }) };
      }
      if (password.length < 6) {
        return { statusCode: 200, headers, body: JSON.stringify({ ok: false, msg: "Password must be at least 6 characters." }) };
      }
      if (email === "qboubert@gmail.com") {
        return { statusCode: 200, headers, body: JSON.stringify({ ok: false, msg: "That email is reserved." }) };
      }
      const existing = findAffiliateByEmail(state, email);
      if (existing) {
        return { statusCode: 200, headers, body: JSON.stringify({ ok: false, msg: "Email already registered." }) };
      }
      const code = body.code || makeCode(state);
      const user = upsertAffiliateUser(state, {
        email,
        code,
        passwordHash: hashPassword(password),
        earnings: 0,
        sales: 0,
        paidOut: 0,
        created: Date.now(),
        lastSeen: Date.now(),
      });
      await saveAffiliateState(store, state);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, user: publicUser(user), userCount: state.users.length }),
      };
    }

    if (action === "login") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const user = findAffiliateByEmail(state, email);
      if (!user || !user.passwordHash || user.passwordHash !== hashPassword(password)) {
        return { statusCode: 200, headers, body: JSON.stringify({ ok: false, msg: "Invalid email or password." }) };
      }
      user.lastSeen = Date.now();
      upsertAffiliateUser(state, user);
      await saveAffiliateState(store, state);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, user: publicUser(user) }),
      };
    }

    if (action === "upsert" && body.user) {
      // Never wipe passwordHash / higher stats via thin client upserts
      const incoming = { ...body.user };
      if (body.password) incoming.passwordHash = hashPassword(body.password);
      incoming.lastSeen = Date.now();
      const user = upsertAffiliateUser(state, incoming);
      await saveAffiliateState(store, state);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, user: publicUser(user), userCount: state.users.length }),
      };
    }

    if (action === "click" && body.code) {
      const code = String(body.code);
      state.clicks[code] = (state.clicks[code] || 0) + 1;
      await saveAffiliateState(store, state);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, clicks: state.clicks[code], code }),
      };
    }

    if (action === "sale" && body.sale) {
      state.sales.push(body.sale);
      if (body.user) upsertAffiliateUser(state, body.user);
      await saveAffiliateState(store, state);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, userCount: state.users.length }) };
    }

    if (action === "cashout" && body.cashout) {
      const id = body.cashout.id;
      const idx = state.cashouts.findIndex((c) => c.id === id);
      if (idx >= 0) state.cashouts[idx] = body.cashout;
      else state.cashouts.push(body.cashout);
      await saveAffiliateState(store, state);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (action === "cashout-paid" && body.cashout) {
      const id = body.cashout.id;
      const idx = state.cashouts.findIndex((c) => c.id === id);
      if (idx >= 0) state.cashouts[idx] = { ...state.cashouts[idx], ...body.cashout };
      else state.cashouts.push(body.cashout);
      await saveAffiliateState(store, state);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (action === "list" || action === "snapshot") {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          live: true,
          userCount: state.users.length,
          users: state.users.map(publicUser),
          clicks: state.clicks || {},
          sales: state.sales || [],
          cashouts: state.cashouts || [],
        }),
      };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, msg: "Unknown action" }) };
  } catch (err) {
    console.error("affiliate-api error:", err);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: false, msg: err.message || "Affiliate API error" }),
    };
  }
};
