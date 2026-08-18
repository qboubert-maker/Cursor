/* BlankDelay affiliate registry for Netlify (shared across browsers when Blobs available) */
const { getStore } = require("@netlify/blobs");

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

async function loadState(store) {
  try {
    const raw = await store.get("state", { type: "json" });
    if (raw && typeof raw === "object") {
      return {
        users: Array.isArray(raw.users) ? raw.users : [],
        clicks: raw.clicks && typeof raw.clicks === "object" ? raw.clicks : {},
        sales: Array.isArray(raw.sales) ? raw.sales : [],
        cashouts: Array.isArray(raw.cashouts) ? raw.cashouts : [],
      };
    }
  } catch (_) {}
  return { users: [], clicks: {}, sales: [], cashouts: [] };
}

async function saveState(store, state) {
  await store.setJSON("state", state);
}

function upsertUser(state, user) {
  if (!user || !user.email || !user.code) return;
  const key = String(user.email).toLowerCase();
  const idx = state.users.findIndex((u) => String(u.email).toLowerCase() === key);
  const row = {
    email: key,
    code: user.code,
    earnings: Number(user.earnings) || 0,
    sales: Number(user.sales) || 0,
    paidOut: Number(user.paidOut) || 0,
    created: user.created || Date.now(),
  };
  if (idx >= 0) state.users[idx] = { ...state.users[idx], ...row };
  else state.users.push(row);
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  let store;
  try {
    store = getStore("bd-affiliates");
  } catch (err) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: false, msg: "Affiliate store unavailable", detail: String(err && err.message) }),
    };
  }

  const state = await loadState(store);
  const qs = event.queryStringParameters || {};

  if (event.httpMethod === "GET") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, ...state }),
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

  if (action === "upsert" && body.user) {
    upsertUser(state, body.user);
  } else if (action === "click" && body.code) {
    const code = String(body.code);
    state.clicks[code] = (state.clicks[code] || 0) + 1;
  } else if (action === "sale" && body.sale) {
    state.sales.push(body.sale);
    if (body.user) upsertUser(state, body.user);
  } else if (action === "cashout" && body.cashout) {
    const id = body.cashout.id;
    const idx = state.cashouts.findIndex((c) => c.id === id);
    if (idx >= 0) state.cashouts[idx] = body.cashout;
    else state.cashouts.push(body.cashout);
  } else if (action === "cashout-paid" && body.cashout) {
    const id = body.cashout.id;
    const idx = state.cashouts.findIndex((c) => c.id === id);
    if (idx >= 0) state.cashouts[idx] = { ...state.cashouts[idx], ...body.cashout };
    else state.cashouts.push(body.cashout);
  } else if (action === "snapshot") {
    /* no-op write */
  } else {
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, msg: "Unknown action" }) };
  }

  await saveState(store, state);
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, ...state }) };
};
