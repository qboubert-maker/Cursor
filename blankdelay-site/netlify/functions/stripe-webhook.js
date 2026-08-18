const crypto = require("crypto");
const { bdLicenseFromSessionId } = require("./license-key");

const EMAILJS = {
  serviceId: "service_6e3o39a",
  templateId: "template_3kbh949",
  publicKey: "HQzkaNZvZNsXOY02t",
};

const CATALOG = {
  premium: {
    name: "Blank Premium Utility",
    price: 29.99,
    setupFile: "BlankDelay-Blank-Premium-Utility-Setup.exe",
  },
  "zero-plus": {
    name: "Zero Delay Plus",
    price: 14.99,
    setupFile: "BlankDelay-Zero-Delay-Plus-Setup.exe",
  },
  zero: {
    name: "Zero Delay",
    price: 9.99,
    setupFile: "BlankDelay-Zero-Delay-Setup.exe",
  },
  fps: {
    name: "FPS Boost",
    price: 9.99,
    setupFile: "BlankDelay-FPS-Boost-Setup.exe",
  },
  ping: {
    name: "Ping Optimizer",
    price: 9.99,
    setupFile: "BlankDelay-Ping-Optimizer-Setup.exe",
  },
  controller: {
    name: "Controller Macro",
    price: 19.99,
    setupFile: "BlankDelay-Controller-Macro-V2-Setup.exe",
  },
  keyboard: {
    name: "Keyboard Macro",
    price: 19.99,
    setupFile: "BlankDelay-Keyboard-Macro-V2-Setup.exe",
  },
  aim: {
    name: "Aim Bundle",
    price: 14.99,
    setupFile: "BlankDelay-Aim-Bundle-Setup.exe",
  },
  shotgun: {
    name: "Shotgun Pack",
    price: 9.99,
    setupFile: "BlankDelay-Shotgun-Pack-Setup.exe",
  },
  "blank-pass-full": {
    name: "Blank Pass - Full Kit",
    price: 39.99,
    setupFile: "BlankDelay-Setup.exe",
  },
  "blank-pass-monthly": {
    name: "Blank Pass Monthly",
    price: 9.99,
    setupFile: "BlankDelay-Setup.exe",
  },
  "gift-card": {
    name: "BlankDelay Gift Card",
    price: 50,
    setupFile: "BlankDelay-Setup.exe",
  },
};

function downloadLinkForSlug(slug) {
  const cat = CATALOG[slug] || CATALOG.premium;
  return `https://blankdelay.com/downloads/${cat.setupFile}`;
}


function formatPrice(n) {
  return "$" + Number(n).toFixed(2);
}

function slugFromProductName(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("premium")) return "premium";
  if (n.includes("zero delay plus") || n.includes("zero plus")) return "zero-plus";
  if (n.includes("zero delay")) return "zero";
  if (n.includes("fps")) return "fps";
  if (n.includes("ping")) return "ping";
  if (n.includes("controller")) return "controller";
  if (n.includes("keyboard")) return "keyboard";
  if (n.includes("aim")) return "aim";
  if (n.includes("shotgun")) return "shotgun";
  if (n.includes("full kit") || n.includes("blank pass")) return "blank-pass-full";
  if (n.includes("monthly") || n.includes("subscription")) return "blank-pass-monthly";
  if (n.includes("gift")) return "gift-card";
  return "premium";
}

function slugFromAmount(cents, mode) {
  if (mode === "subscription") return "blank-pass-monthly";
  const map = {
    2999: "premium",
    1499: "zero-plus",
    999: "zero",
    1999: "controller",
    3999: "blank-pass-full",
    5000: "gift-card",
  };
  return map[cents] || "premium";
}

function verifyStripeSignature(payload, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  const parts = sigHeader.split(",").reduce((acc, part) => {
    const [k, v] = part.split("=");
    if (k && v) acc[k] = v;
    return acc;
  }, {});
  if (!parts.t || !parts.v1) return false;
  const signed = parts.t + "." + payload;
  const expected = crypto.createHmac("sha256", secret).update(signed, "utf8").digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(parts.v1, "hex"));
  } catch (_err) {
    return false;
  }
}

async function fetchStripeSession(sessionId, secretKey) {
  const url = `https://api.stripe.com/v1/checkout/sessions/${sessionId}?expand[]=line_items.data.price.product`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!res.ok) throw new Error("Stripe session fetch failed: " + res.status);
  return res.json();
}

async function sendEmailJS(order) {
  const slug = order.slug || "premium";
  const thankYouLink =
    "https://blankdelay.com/thank-you.html?session_id=" + encodeURIComponent(order.id);
  const deliveryLink = thankYouLink;
  const downloadLink = downloadLinkForSlug(slug);
  const body = {
    service_id: EMAILJS.serviceId,
    template_id: EMAILJS.templateId,
    user_id: EMAILJS.publicKey,
    template_params: {
      to_email: order.email,
      customer_name: order.name || "Customer",
      product_name: order.product,
      order_id: order.id,
      order_total: formatPrice(order.price),
      license_key: order.license,
      license_list: order.license,
      delivery_link: deliveryLink,
      download_link: downloadLink,
      security_notice:
        "<p><strong>Windows may show a security warning.</strong> This is a common false positive for new software. Click More info, then Run anyway. Your download is safe.</p>",
      security_notice_text:
        "Windows may show a false warning. Click More info, then Run anyway. BlankDelay is safe.",
      reply_to: order.email,
    },
  };
  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error("EmailJS failed: " + text);
  }
  return true;
}

const { creditAffiliateSale } = require("../lib/affiliate-credit");

async function creditAffiliateFromSession(session, price, productName, stripeSecret, lambdaEvent) {
  const affCode = session.client_reference_id || session.metadata?.aff || "";
  return creditAffiliateSale({
    event: lambdaEvent,
    affCode,
    price,
    productName,
    sessionId: session.id || "",
    stripeSecret,
    tryTransfer: true,
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const sig = event.headers["stripe-signature"] || event.headers["Stripe-Signature"];
  const rawBody = event.body;

  if (!webhookSecret) {
    return { statusCode: 500, body: "STRIPE_WEBHOOK_SECRET not configured" };
  }

  if (!verifyStripeSignature(rawBody, sig, webhookSecret)) {
    return { statusCode: 400, body: "Invalid signature" };
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(rawBody);
  } catch (_err) {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  if (stripeEvent.type !== "checkout.session.completed") {
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  }

  const session = stripeEvent.data.object;
  const email = session.customer_details?.email || session.customer_email;
  if (!email) {
    return { statusCode: 200, body: JSON.stringify({ skipped: "no email" }) };
  }

  let slug = session.metadata?.product_slug || "";
  let productName = "";
  let price = (session.amount_total || 0) / 100;

  if (stripeSecret && session.id) {
    try {
      const full = await fetchStripeSession(session.id, stripeSecret);
      const item = full.line_items?.data?.[0];
      productName =
        item?.description ||
        item?.price?.product?.name ||
        item?.price?.nickname ||
        "";
      if (!slug && productName) slug = slugFromProductName(productName);
      if (full.amount_total) price = full.amount_total / 100;
      if (full.client_reference_id && !session.client_reference_id) {
        session.client_reference_id = full.client_reference_id;
      }
    } catch (err) {
      console.error("Session expand error:", err.message);
    }
  }

  if (!slug) slug = slugFromAmount(session.amount_total, session.mode);
  const catalog = CATALOG[slug] || CATALOG.premium;
  if (!productName) productName = catalog.name;

  const order = {
    id: session.id || "BD-" + Date.now().toString(36).toUpperCase(),
    slug,
    product: productName,
    email,
    name: session.customer_details?.name || "Customer",
    price,
    license: bdLicenseFromSessionId(session.id),
  };

  let affiliateResult = null;
  try {
    affiliateResult = await creditAffiliateFromSession(session, price, productName, stripeSecret, event);
  } catch (err) {
    console.error("Affiliate credit error:", err.message);
    affiliateResult = { ok: false, reason: err.message };
  }

  try {
    await sendEmailJS(order);
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, order: order.id, affiliate: affiliateResult }),
    };
  } catch (err) {
    console.error("Fulfillment error:", err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message, affiliate: affiliateResult }) };
  }
};
