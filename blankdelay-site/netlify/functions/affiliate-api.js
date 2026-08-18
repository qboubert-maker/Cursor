/* BlankDelay affiliate registry for Netlify (shared across browsers when Blobs available) */
const {
  getAffiliateStore,
  loadAffiliateState,
  saveAffiliateState,
  upsertAffiliateUser,
} = require("./affiliate-store");

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  let store;
  try {
    store = getAffiliateStore();
  } catch (err) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: false, msg: "Affiliate store unavailable", detail: String(err && err.message) }),
    };
  }

  const state = await loadAffiliateState(store);
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
    upsertAffiliateUser(state, body.user);
  } else if (action === "click" && body.code) {
    const code = String(body.code);
    state.clicks[code] = (state.clicks[code] || 0) + 1;
  } else if (action === "sale" && body.sale) {
    state.sales.push(body.sale);
    if (body.user) upsertAffiliateUser(state, body.user);
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

  await saveAffiliateState(store, state);
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, ...state }) };
};
