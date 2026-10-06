const { bdLicenseFromSessionId } = require("./license-key");

const CATALOG = {
  premium: { name: "Blank Premium Utility", setupFile: "BlankDelay-Blank-Premium-Utility-Setup.exe" },
  "zero-plus": { name: "Zero Delay Plus", setupFile: "BlankDelay-Zero-Delay-Plus-Setup.exe" },
  zero: { name: "Zero Delay", setupFile: "BlankDelay-Zero-Delay-Setup.exe" },
  fps: { name: "FPS Boost", setupFile: "BlankDelay-FPS-Boost-Setup.exe" },
  ping: { name: "Ping Optimizer", setupFile: "BlankDelay-Ping-Optimizer-Setup.exe" },
  controller: { name: "Controller Macro", setupFile: "BlankDelay-Controller-Macro-V2-Setup.exe" },
  keyboard: { name: "Keyboard Macro", setupFile: "BlankDelay-Keyboard-Macro-V2-Setup.exe" },
  aim: { name: "Aim Bundle", setupFile: "BlankDelay-Aim-Bundle-Setup.exe" },
  shotgun: { name: "Shotgun Pack", setupFile: "BlankDelay-Shotgun-Pack-Setup.exe" },
  "blank-pass-full": { name: "Blank Pass - Full Kit", setupFile: "BlankDelay-Setup.exe" },
  "blank-pass-monthly": { name: "Blank Pass Monthly", setupFile: "BlankDelay-Setup.exe" },
  "gift-card": { name: "BlankDelay Gift Card", setupFile: "BlankDelay-Setup.exe" },
};

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
  const map = { 2999: "premium", 1499: "zero-plus", 999: "zero", 1999: "controller", 3999: "blank-pass-full", 5000: "gift-card" };
  return map[cents] || "premium";
}

function downloadLinkForSlug(slug, origin) {
  const cat = CATALOG[slug] || CATALOG.premium;
  const base = (origin || "https://blankdelay.com").replace(/\/$/, "");
  return `${base}/downloads/${cat.setupFile}`;
}

async function fetchStripeSession(sessionId, secretKey) {
  const url = `https://api.stripe.com/v1/checkout/sessions/${sessionId}?expand[]=line_items.data.price.product`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${secretKey}` } });
  if (!res.ok) throw new Error("Stripe session fetch failed: " + res.status);
  return res.json();
}

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const sessionId = event.queryStringParameters?.session_id;
  if (!sessionId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "session_id required" }) };
  }

  const origin = event.headers.origin || event.headers.Origin || "https://blankdelay.com";
  const license = bdLicenseFromSessionId(sessionId);
  let slug = "";
  let productName = "";
  let email = "";
  let price = 0;
  let orderId = sessionId;

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (stripeSecret) {
    try {
      const session = await fetchStripeSession(sessionId, stripeSecret);
      slug = session.metadata?.product_slug || "";
      email = session.customer_details?.email || session.customer_email || "";
      price = (session.amount_total || 0) / 100;
      productName =
        session.metadata?.product_name ||
        session.line_items?.data?.[0]?.description ||
        session.line_items?.data?.[0]?.price?.product?.name ||
        "";
      if (!slug && productName) slug = slugFromProductName(productName);
      if (!slug) slug = slugFromAmount(session.amount_total, session.mode);
      if (session.metadata?.license_key) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            ok: true,
            license: session.metadata.license_key,
            slug,
            product: productName || (CATALOG[slug] || CATALOG.premium).name,
            email,
            price,
            orderId: session.id,
            downloadUrl: downloadLinkForSlug(slug, origin),
          }),
        };
      }
    } catch (err) {
      console.error("get-fulfillment:", err.message);
    }
  }

  if (!slug) slug = "premium";
  const catalog = CATALOG[slug] || CATALOG.premium;
  if (!productName) productName = catalog.name;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      ok: true,
      license,
      slug,
      product: productName,
      email,
      price,
      orderId,
      downloadUrl: downloadLinkForSlug(slug, origin),
      note: stripeSecret ? undefined : "Stripe not configured — showing session-based key",
    }),
  };
};
