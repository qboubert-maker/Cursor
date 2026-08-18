/* Shared BlankDelay affiliate Blobs helpers */
function getAffiliateStore(event) {
  const blobs = require("@netlify/blobs");
  const { getStore, connectLambda } = blobs;

  // Required when Functions run in Lambda compatibility mode (Netlify default for exports.handler)
  if (event && typeof connectLambda === "function") {
    try {
      connectLambda(event);
    } catch (err) {
      console.warn("connectLambda warning:", err && err.message);
    }
  }

  // Prefer simple name form after context is connected
  try {
    return getStore("bd-affiliates");
  } catch (err1) {
    try {
      return getStore({ name: "bd-affiliates", consistency: "strong" });
    } catch (err2) {
      const detail = [err1 && err1.message, err2 && err2.message].filter(Boolean).join(" | ");
      const e = new Error(detail || "getStore failed");
      throw e;
    }
  }
}

async function loadAffiliateState(store) {
  try {
    const raw = await store.get("state", { type: "json" });
    if (raw && typeof raw === "object") {
      return {
        users: Array.isArray(raw.users) ? raw.users : [],
        clicks: raw.clicks && typeof raw.clicks === "object" ? raw.clicks : {},
        sales: Array.isArray(raw.sales) ? raw.sales : [],
        cashouts: Array.isArray(raw.cashouts) ? raw.cashouts : [],
        creditedSessions: Array.isArray(raw.creditedSessions) ? raw.creditedSessions : [],
      };
    }
  } catch (_) {}
  return { users: [], clicks: {}, sales: [], cashouts: [], creditedSessions: [] };
}

async function saveAffiliateState(store, state) {
  await store.setJSON("state", state);
}

function upsertAffiliateUser(state, user) {
  if (!user || !user.email || !user.code) return null;
  const key = String(user.email).toLowerCase();
  const idx = state.users.findIndex((u) => String(u.email).toLowerCase() === key);
  const incoming = {
    email: key,
    code: String(user.code),
    earnings: Number(user.earnings) || 0,
    sales: Number(user.sales) || 0,
    paidOut: Number(user.paidOut) || 0,
    created: user.created || Date.now(),
    stripeAccountId: user.stripeAccountId || "",
    payoutsEnabled: !!user.payoutsEnabled,
    passwordHash: user.passwordHash || "",
    lastSeen: user.lastSeen || Date.now(),
  };
  if (idx >= 0) {
    const prev = state.users[idx];
    state.users[idx] = {
      ...prev,
      email: key,
      code: incoming.code || prev.code,
      earnings: Math.max(Number(prev.earnings) || 0, incoming.earnings),
      sales: Math.max(Number(prev.sales) || 0, incoming.sales),
      paidOut: Math.max(Number(prev.paidOut) || 0, incoming.paidOut),
      created: Math.min(Number(prev.created) || Date.now(), Number(incoming.created) || Date.now()),
      stripeAccountId: incoming.stripeAccountId || prev.stripeAccountId || "",
      payoutsEnabled: !!(incoming.payoutsEnabled || prev.payoutsEnabled),
      passwordHash: incoming.passwordHash || prev.passwordHash || "",
      lastSeen: Math.max(Number(prev.lastSeen) || 0, Number(incoming.lastSeen) || 0),
    };
    return state.users[idx];
  }
  state.users.push(incoming);
  return incoming;
}

function publicUser(u) {
  if (!u) return null;
  return {
    email: u.email,
    code: u.code,
    earnings: u.earnings || 0,
    sales: u.sales || 0,
    paidOut: u.paidOut || 0,
    created: u.created || 0,
    lastSeen: u.lastSeen || 0,
    stripeAccountId: u.stripeAccountId || "",
    payoutsEnabled: !!u.payoutsEnabled,
    link: "https://blankdelay.com/a/" + encodeURIComponent(u.code),
  };
}

function findAffiliateByCode(state, code) {
  const c = String(code || "").trim();
  if (!c) return null;
  return state.users.find((u) => String(u.code).toUpperCase() === c.toUpperCase()) || null;
}

function findAffiliateByEmail(state, email) {
  const key = String(email || "").trim().toLowerCase();
  if (!key) return null;
  return state.users.find((u) => String(u.email).toLowerCase() === key) || null;
}

module.exports = {
  getAffiliateStore,
  loadAffiliateState,
  saveAffiliateState,
  upsertAffiliateUser,
  publicUser,
  findAffiliateByCode,
  findAffiliateByEmail,
};
