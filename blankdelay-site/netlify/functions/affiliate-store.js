/* Shared BlankDelay affiliate Blobs helpers */
function getAffiliateStore() {
  const { getStore } = require("@netlify/blobs");
  return getStore("bd-affiliates");
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
  const row = {
    email: key,
    code: user.code,
    earnings: Number(user.earnings) || 0,
    sales: Number(user.sales) || 0,
    paidOut: Number(user.paidOut) || 0,
    created: user.created || Date.now(),
    stripeAccountId: user.stripeAccountId || "",
    payoutsEnabled: !!user.payoutsEnabled,
  };
  if (idx >= 0) {
    state.users[idx] = { ...state.users[idx], ...row };
    return state.users[idx];
  }
  state.users.push(row);
  return row;
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
  findAffiliateByCode,
  findAffiliateByEmail,
};
