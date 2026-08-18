/* Shared BlankDelay affiliate Blobs helpers (ESM-safe for Netlify Functions) */

let blobsModPromise = null;

async function loadBlobs() {
  if (!blobsModPromise) {
    // Dynamic import works with ESM-only @netlify/blobs (CJS require() crashes on live)
    blobsModPromise = import("@netlify/blobs").catch((err) => {
      blobsModPromise = null;
      throw err;
    });
  }
  return blobsModPromise;
}

async function getAffiliateStore(event) {
  const blobs = await loadBlobs();
  const { getStore, connectLambda } = blobs;

  // Required when Functions run in Lambda compatibility mode (exports.handler)
  if (event && typeof connectLambda === "function") {
    try {
      connectLambda(event);
    } catch (err) {
      console.warn("connectLambda warning:", err && err.message);
    }
  }

  try {
    return getStore("bd-affiliates");
  } catch (err1) {
    try {
      return getStore({ name: "bd-affiliates", consistency: "strong" });
    } catch (err2) {
      const detail = [err1 && err1.message, err2 && err2.message].filter(Boolean).join(" | ");
      throw new Error(detail || "getStore failed");
    }
  }
}

function normalizeCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 32);
}

function emptyState() {
  return {
    users: [],
    clicks: {},
    sales: [],
    cashouts: [],
    creditedSessions: [],
    pendingByCode: [],
  };
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
        pendingByCode: Array.isArray(raw.pendingByCode) ? raw.pendingByCode : [],
      };
    }
  } catch (_) {}
  return emptyState();
}

async function saveAffiliateState(store, state) {
  await store.setJSON("state", state);
}

/** Merge case variants of a click code into one uppercase key and increment. */
function bumpClick(state, code) {
  const key = normalizeCode(code);
  if (!key || key === "ADMIN") return 0;
  let total = 0;
  Object.keys(state.clicks || {}).forEach((k) => {
    if (String(k).toUpperCase() === key) {
      total += Number(state.clicks[k]) || 0;
      if (k !== key) delete state.clicks[k];
    }
  });
  state.clicks[key] = total + 1;
  return state.clicks[key];
}

function clicksForCode(clicksMap, code) {
  const key = normalizeCode(code);
  if (!key) return 0;
  let total = 0;
  Object.entries(clicksMap || {}).forEach(([k, v]) => {
    if (String(k).toUpperCase() === key) total += Number(v) || 0;
  });
  return total;
}

async function withStateRetry(store, mutator, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const state = await loadAffiliateState(store);
      const result = await mutator(state);
      await saveAffiliateState(store, state);
      return result;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 40 * (i + 1)));
    }
  }
  throw lastErr || new Error("affiliate state retry failed");
}

function upsertAffiliateUser(state, user) {
  if (!user || !user.email || !user.code) return null;
  const key = String(user.email).toLowerCase();
  const code = normalizeCode(user.code) || String(user.code);
  const idx = state.users.findIndex((u) => String(u.email).toLowerCase() === key);
  const incoming = {
    email: key,
    code,
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
  const c = normalizeCode(code);
  if (!c) return null;
  return state.users.find((u) => normalizeCode(u.code) === c) || null;
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
  normalizeCode,
  bumpClick,
  clicksForCode,
  withStateRetry,
  emptyState,
};
