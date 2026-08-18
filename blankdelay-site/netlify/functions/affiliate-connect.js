/* Stripe Connect onboarding + auto-payout helpers for affiliates */
const {
  getAffiliateStore,
  loadAffiliateState,
  saveAffiliateState,
  findAffiliateByCode,
  findAffiliateByEmail,
  upsertAffiliateUser,
} = require("../lib/affiliate-store");

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

const SITE = "https://blankdelay.com";

async function stripeForm(secret, path, params) {
  const body = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    body.append(k, String(v));
  });
  const res = await fetch("https://api.stripe.com/v1/" + path, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + secret,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || "Stripe error " + res.status;
    const err = new Error(msg);
    err.status = res.status;
    err.json = json;
    throw err;
  }
  return json;
}

async function stripeGet(secret, path) {
  const res = await fetch("https://api.stripe.com/v1/" + path, {
    headers: { Authorization: "Bearer " + secret },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || "Stripe error " + res.status;
    throw new Error(msg);
  }
  return json;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: false,
        msg: "STRIPE_SECRET_KEY not set on Netlify. Add it in Site settings → Environment variables.",
      }),
    };
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
  let body = {};
  if (event.httpMethod === "POST") {
    try {
      body = JSON.parse(event.body || "{}");
    } catch (_) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, msg: "Invalid JSON" }) };
    }
  }

  const action = body.action || qs.action || "";
  const email = String(body.email || qs.email || "").trim().toLowerCase();
  const code = String(body.code || qs.code || "").trim();

  try {
    if (action === "status") {
      let user = findAffiliateByEmail(state, email) || findAffiliateByCode(state, code);
      if (!user) {
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, connected: false, payoutsEnabled: false }) };
      }
      let payoutsEnabled = !!user.payoutsEnabled;
      if (user.stripeAccountId) {
        const acct = await stripeGet(secret, "accounts/" + user.stripeAccountId);
        payoutsEnabled = !!(acct.payouts_enabled && acct.details_submitted);
        user.payoutsEnabled = payoutsEnabled;
        upsertAffiliateUser(state, user);
        await saveAffiliateState(store, state);
      }
      const available = Math.max(0, (user.earnings || 0) - (user.paidOut || 0));
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          connected: !!user.stripeAccountId,
          payoutsEnabled,
          stripeAccountId: user.stripeAccountId || "",
          available: +available.toFixed(2),
          earnings: user.earnings || 0,
          paidOut: user.paidOut || 0,
        }),
      };
    }

    if (action === "onboard") {
      let user = findAffiliateByEmail(state, email) || findAffiliateByCode(state, code);
      if (!user) {
        if (!email || !code) {
          return { statusCode: 400, headers, body: JSON.stringify({ ok: false, msg: "email and code required" }) };
        }
        user = upsertAffiliateUser(state, {
          email,
          code,
          earnings: 0,
          sales: 0,
          paidOut: 0,
          created: Date.now(),
        });
      }

      if (!user.stripeAccountId) {
        const acct = await stripeForm(secret, "accounts", {
          type: "express",
          email: user.email,
          "capabilities[transfers][requested]": "true",
          "business_profile[product_description]": "BlankDelay creator affiliate commissions",
          "metadata[affiliate_code]": user.code,
          "metadata[affiliate_email]": user.email,
        });
        user.stripeAccountId = acct.id;
        upsertAffiliateUser(state, user);
        await saveAffiliateState(store, state);
      }

      const refreshUrl = SITE + "/index.html?aff_connect=refresh#specials";
      const returnUrl = SITE + "/index.html?aff_connect=done#specials";
      const link = await stripeForm(secret, "account_links", {
        account: user.stripeAccountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: "account_onboarding",
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          url: link.url,
          stripeAccountId: user.stripeAccountId,
        }),
      };
    }

    if (action === "payout-available") {
      let user = findAffiliateByEmail(state, email) || findAffiliateByCode(state, code);
      if (!user || !user.stripeAccountId) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ ok: false, msg: "Connect Stripe payouts first." }),
        };
      }
      const acct = await stripeGet(secret, "accounts/" + user.stripeAccountId);
      if (!(acct.payouts_enabled && acct.details_submitted)) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ ok: false, msg: "Finish Stripe onboarding before cashout." }),
        };
      }
      const available = Math.max(0, (user.earnings || 0) - (user.paidOut || 0));
      const amount = body.amount != null ? Number(body.amount) : available;
      const dollars = +Math.min(available, amount).toFixed(2);
      if (dollars < 5) {
        return { statusCode: 200, headers, body: JSON.stringify({ ok: false, msg: "Minimum auto-payout is $5.00." }) };
      }
      const cents = Math.round(dollars * 100);
      const transfer = await stripeForm(secret, "transfers", {
        amount: String(cents),
        currency: "usd",
        destination: user.stripeAccountId,
        description: "BlankDelay affiliate cashout " + user.code,
        "metadata[affiliate_code]": user.code,
        "metadata[affiliate_email]": user.email,
        "metadata[type]": "manual_cashout",
      });
      user.paidOut = +((user.paidOut || 0) + dollars).toFixed(2);
      user.payoutsEnabled = true;
      upsertAffiliateUser(state, user);
      state.cashouts.push({
        id: "CO-AUTO-" + Date.now().toString(36).toUpperCase(),
        email: user.email,
        code: user.code,
        amount: dollars,
        method: "stripe",
        payoutTo: user.stripeAccountId,
        status: "paid",
        created: Date.now(),
        paidAt: Date.now(),
        transferId: transfer.id,
        auto: true,
      });
      await saveAffiliateState(store, state);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, transferId: transfer.id, amount: dollars, paidOut: user.paidOut }),
      };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, msg: "Unknown action" }) };
  } catch (err) {
    console.error("affiliate-connect error:", err.message);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: false, msg: err.message || "Connect error" }),
    };
  }
};
