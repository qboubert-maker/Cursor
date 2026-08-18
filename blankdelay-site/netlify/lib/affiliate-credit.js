/* Shared affiliate commission crediting (webhook + thank-you backup) */
const {
  getAffiliateStore,
  loadAffiliateState,
  saveAffiliateState,
  upsertAffiliateUser,
  findAffiliateByCode,
} = require("./affiliate-store");

const AFFILIATE_RATE = 0.2;

async function stripeGet(secretKey, path) {
  const res = await fetch("https://api.stripe.com/v1/" + path, {
    headers: { Authorization: "Bearer " + secretKey },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || "Stripe GET failed " + res.status);
  return json;
}

async function stripeForm(secretKey, path, params) {
  const body = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    body.append(k, String(v));
  });
  const res = await fetch("https://api.stripe.com/v1/" + path, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + secretKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || "Stripe " + path + " failed");
  return json;
}

function applyPendingForCode(state, user) {
  if (!user || !user.code) return user;
  const pending = Array.isArray(state.pendingByCode) ? state.pendingByCode : [];
  const keep = [];
  let changed = false;
  pending.forEach((p) => {
    if (String(p.code).toUpperCase() !== String(user.code).toUpperCase()) {
      keep.push(p);
      return;
    }
    user.earnings = +((user.earnings || 0) + (p.commission || 0)).toFixed(2);
    user.sales = (user.sales || 0) + 1;
    state.sales.push({
      code: user.code,
      amount: p.amount || 0,
      commission: p.commission || 0,
      product: p.product || "BlankDelay Product",
      date: p.date || Date.now(),
      sessionId: p.sessionId || "",
      payoutStatus: "pending",
      appliedFromPending: true,
    });
    changed = true;
  });
  if (changed) state.pendingByCode = keep;
  return user;
}

async function creditAffiliateSale({
  event,
  affCode,
  price,
  productName,
  sessionId,
  stripeSecret,
  tryTransfer,
}) {
  const code = String(affCode || "").trim();
  if (!code) return { ok: false, reason: "no_affiliate" };

  const store = getAffiliateStore(event);
  const state = await loadAffiliateState(store);
  if (!Array.isArray(state.pendingByCode)) state.pendingByCode = [];
  if (!Array.isArray(state.creditedSessions)) state.creditedSessions = [];

  if (sessionId && state.creditedSessions.includes(sessionId)) {
    return { ok: true, reason: "already_credited", code };
  }

  const commission = +((Number(price) || 0) * AFFILIATE_RATE).toFixed(2);
  if (commission <= 0) return { ok: false, reason: "zero_commission" };

  let user = findAffiliateByCode(state, code);
  const sale = {
    code,
    amount: Number(price) || 0,
    commission,
    product: productName || "BlankDelay Product",
    date: Date.now(),
    sessionId: sessionId || "",
    payoutStatus: "pending",
    transferId: "",
  };

  if (!user) {
    // Affiliate link was used but account not in registry yet — hold commission for that code
    state.pendingByCode.push({
      code,
      amount: sale.amount,
      commission,
      product: sale.product,
      date: sale.date,
      sessionId: sale.sessionId,
    });
    if (sessionId) state.creditedSessions.push(sessionId);
    await saveAffiliateState(store, state);
    return { ok: true, reason: "pending_until_affiliate_login", code, commission };
  }

  user.earnings = +((user.earnings || 0) + commission).toFixed(2);
  user.sales = (user.sales || 0) + 1;

  let transferError = "";
  if (tryTransfer && stripeSecret && user.stripeAccountId) {
    try {
      const cents = Math.round(commission * 100);
      if (cents >= 1) {
        const transfer = await stripeForm(stripeSecret, "transfers", {
          amount: String(cents),
          currency: "usd",
          destination: user.stripeAccountId,
          description: "BlankDelay affiliate 20% · " + user.code,
          transfer_group: sessionId || user.code,
          "metadata[affiliate_code]": user.code,
          "metadata[affiliate_email]": user.email,
          "metadata[session_id]": sessionId || "",
        });
        sale.payoutStatus = "auto_paid";
        sale.transferId = transfer.id;
        user.paidOut = +((user.paidOut || 0) + commission).toFixed(2);
        user.payoutsEnabled = true;
        state.cashouts.push({
          id: "CO-SALE-" + Date.now().toString(36).toUpperCase(),
          email: user.email,
          code: user.code,
          amount: commission,
          method: "stripe",
          payoutTo: user.stripeAccountId,
          status: "paid",
          created: Date.now(),
          paidAt: Date.now(),
          transferId: transfer.id,
          auto: true,
          sessionId: sessionId || "",
        });
      }
    } catch (err) {
      transferError = err.message || "transfer_failed";
      sale.payoutStatus = "pending";
    }
  }

  state.sales.push(sale);
  upsertAffiliateUser(state, user);
  if (sessionId) state.creditedSessions.push(sessionId);
  if (state.creditedSessions.length > 5000) {
    state.creditedSessions = state.creditedSessions.slice(-4000);
  }
  await saveAffiliateState(store, state);

  return {
    ok: true,
    code: user.code,
    email: user.email,
    commission,
    payoutStatus: sale.payoutStatus,
    transferError: transferError || undefined,
  };
}

async function creditFromCheckoutSession(event, sessionId, stripeSecret) {
  if (!sessionId || !stripeSecret) return { ok: false, reason: "missing_session_or_key" };
  const full = await stripeGet(
    stripeSecret,
    "checkout/sessions/" + encodeURIComponent(sessionId) + "?expand[]=line_items.data.price.product"
  );
  if (full.payment_status && full.payment_status !== "paid" && full.status !== "complete") {
    return { ok: false, reason: "not_paid", status: full.payment_status || full.status };
  }
  const affCode = String(full.client_reference_id || full.metadata?.aff || "").trim();
  const item = full.line_items?.data?.[0];
  const productName =
    item?.description || item?.price?.product?.name || item?.price?.nickname || "BlankDelay Product";
  const price = (full.amount_total || 0) / 100;
  return creditAffiliateSale({
    event,
    affCode,
    price,
    productName,
    sessionId: full.id || sessionId,
    stripeSecret,
    tryTransfer: true,
  });
}

module.exports = {
  AFFILIATE_RATE,
  creditAffiliateSale,
  creditFromCheckoutSession,
  applyPendingForCode,
};
