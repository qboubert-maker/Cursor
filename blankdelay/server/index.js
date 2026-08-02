require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");

const { listProducts, getProduct } = require("./products");
const {
  createKeys,
  validateKey,
  redeemKey,
  stockCounts,
  findByEmail,
  assignKey,
} = require("./keys");
const { fulfillOrder, fulfillFromStripeSession } = require("./fulfill");
const { sendFulfillmentEmail } = require("./email");
const db = require("./db");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "dev-admin-token";

const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const stripe =
  stripeKey && !stripeKey.includes("sk_test_...") && stripeKey.startsWith("sk_")
    ? new Stripe(stripeKey)
    : null;

function requireAdmin(req, res, next) {
  const token = req.header("x-admin-token") || req.query.token;
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// Stripe webhook needs raw body
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!stripe) {
      return res.status(503).send("Stripe not configured");
    }
    const sig = req.headers["stripe-signature"];
    let event;
    try {
      if (process.env.STRIPE_WEBHOOK_SECRET) {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET
        );
      } else {
        event = JSON.parse(req.body.toString("utf8"));
      }
    } catch (err) {
      console.error("Webhook signature error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      if (
        event.type === "checkout.session.completed" ||
        event.type === "checkout.session.async_payment_succeeded"
      ) {
        const session = event.data.object;
        if (session.payment_status === "paid" || event.type.includes("async")) {
          const result = await fulfillFromStripeSession(session);
          console.log("[fulfill]", result);
        }
      }
      res.json({ received: true });
    } catch (err) {
      console.error("[fulfill error]", err);
      res.status(500).json({ error: err.message });
    }
  }
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static hub + downloads (force real file download with BlankDelay filename)
app.use("/hub", express.static(path.join(__dirname, "..", "hub")));
app.use(
  "/downloads",
  (req, res, next) => {
    if (req.path.toLowerCase().endsWith(".zip")) {
      const base = path.basename(req.path);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${base}"`);
    }
    next();
  },
  express.static(path.join(__dirname, "..", "downloads"), {
    setHeaders(res, filePath) {
      if (filePath.toLowerCase().endsWith(".zip")) {
        res.setHeader("Content-Type", "application/zip");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${path.basename(filePath)}"`
        );
      }
    },
  })
);
app.get("/", (_req, res) => res.redirect("/hub"));

app.get("/api/health", (_req, res) => {
  const { getTransporter } = require("./email");
  const smtpUser = process.env.SMTP_USER || "";
  const smtpPass = process.env.SMTP_PASS || "";
  const smtpReady =
    !!(process.env.SMTP_HOST && smtpUser && smtpPass) &&
    !smtpUser.includes("your@") &&
    !String(smtpPass).includes("your-app-password");
  const stripeReady =
    !!process.env.STRIPE_SECRET_KEY &&
    !String(process.env.STRIPE_SECRET_KEY).includes("sk_test_...");
  res.json({
    ok: true,
    service: "blankdelay-fulfillment",
    stripe: stripeReady,
    smtp: smtpReady,
    publicUrl: PUBLIC_URL,
    transporter: !!getTransporter(),
  });
});

app.get("/api/products", (_req, res) => {
  res.json({
    products: listProducts().map((p) => ({
      ...p,
      downloadUrl: `${PUBLIC_URL}${p.downloadPath}`,
    })),
  });
});

app.post("/api/keys/validate", (req, res) => {
  const { key } = req.body || {};
  if (!key) return res.status(400).json({ error: "key required" });
  res.json(validateKey(key));
});

app.post("/api/keys/redeem", (req, res) => {
  const { key } = req.body || {};
  if (!key) return res.status(400).json({ error: "key required" });
  res.json(redeemKey(key));
});

// Manual / test fulfillment (admin)
app.post("/api/admin/fulfill", requireAdmin, async (req, res) => {
  try {
    const { email, productId } = req.body || {};
    const result = await fulfillOrder({
      email,
      productId,
      stripeSessionId: `manual_${Date.now()}`,
      amountCents: Math.round((getProduct(productId)?.price || 0) * 100),
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/admin/keys/create", requireAdmin, (req, res) => {
  try {
    const { productId, count = 10 } = req.body || {};
    const keys = createKeys(productId, Number(count));
    res.json({ created: keys.length, keys });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/admin/stock", requireAdmin, (_req, res) => {
  res.json({ stock: stockCounts() });
});

app.get("/api/admin/orders", requireAdmin, (_req, res) => {
  const rows = db
    .prepare(`SELECT * FROM orders ORDER BY id DESC LIMIT 100`)
    .all();
  res.json({ orders: rows });
});

app.get("/api/admin/lookup", requireAdmin, (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: "email required" });
  res.json({ email, keys: findByEmail(email) });
});

app.post("/api/admin/resend", requireAdmin, async (req, res) => {
  try {
    const { email, productId } = req.body || {};
    let keyCode;
    const existing = findByEmail(email).find((k) => k.product_id === productId);
    if (existing) {
      keyCode = existing.key_code;
    } else {
      keyCode = assignKey({ productId, email, stripeSessionId: `resend_${Date.now()}` });
    }
    const mail = await sendFulfillmentEmail({ email, productId, keyCode });
    res.json({ keyCode, ...mail });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create Stripe Checkout session for a product (optional helper)
app.post("/api/checkout", async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({ error: "Stripe not configured" });
    const { productId, successUrl, cancelUrl } = req.body || {};
    const product = getProduct(productId);
    if (!product) return res.status(400).json({ error: "Unknown product" });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: req.body.email || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(product.price * 100),
            product_data: {
              name: product.name,
              description: product.description,
            },
          },
        },
      ],
      metadata: {
        product_id: product.id,
        product_name: product.name,
      },
      success_url:
        successUrl ||
        `${PUBLIC_URL}/hub/?success=1&product=${encodeURIComponent(product.id)}`,
      cancel_url: cancelUrl || `${PUBLIC_URL}/hub/?canceled=1`,
    });
    res.json({ url: session.url, id: session.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Build real .zip product packages if missing
function ensureDownloads() {
  const { execFileSync } = require("child_process");
  const anyMissing = listProducts().some((p) => {
    const full = path.join(__dirname, "..", p.downloadPath.replace(/^\//, ""));
    return !fs.existsSync(full) || fs.statSync(full).size < 200;
  });
  if (anyMissing) {
    console.log("Building BlankDelay product zip downloads…");
    execFileSync(process.execPath, [path.join(__dirname, "..", "scripts", "build-downloads.js")], {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit",
    });
  }
}

ensureDownloads();

app.listen(PORT, () => {
  console.log(`BlankDelay hub + fulfillment running at ${PUBLIC_URL}`);
  console.log(`Product hub: ${PUBLIC_URL}/hub`);
  console.log(`Stripe webhook: ${PUBLIC_URL}/api/stripe/webhook`);
  console.log(`Admin token header: x-admin-token`);
});
