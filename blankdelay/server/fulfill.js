const db = require("./db");
const { assignKey } = require("./keys");
const { sendFulfillmentEmail } = require("./email");
const { getProduct, resolveProductFromStripe } = require("./products");

async function fulfillOrder({
  email,
  productId,
  stripeSessionId,
  stripePaymentIntent,
  amountCents,
}) {
  if (!email) throw new Error("Missing buyer email");
  if (!productId || !getProduct(productId)) throw new Error(`Unknown product: ${productId}`);

  if (stripeSessionId) {
    const prior = db
      .prepare(`SELECT * FROM orders WHERE stripe_session_id = ?`)
      .get(stripeSessionId);
    if (prior) {
      return {
        duplicate: true,
        email: prior.email,
        productId: prior.product_id,
        keyCode: prior.key_code,
        emailSent: !!prior.email_sent,
      };
    }
  }

  const keyCode = assignKey({
    productId,
    email,
    stripeSessionId,
    stripePaymentIntent,
  });

  const mail = await sendFulfillmentEmail({ email, productId, keyCode });

  db.prepare(
    `INSERT INTO orders (email, product_id, key_code, stripe_session_id, stripe_payment_intent, amount_cents, email_sent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    email,
    productId,
    keyCode,
    stripeSessionId || null,
    stripePaymentIntent || null,
    amountCents || null,
    mail.sent ? 1 : 0
  );

  return {
    duplicate: false,
    email,
    productId,
    keyCode,
    emailSent: mail.sent,
    downloadUrl: mail.downloadUrl,
    mailReason: mail.reason || null,
  };
}

async function fulfillFromStripeSession(session) {
  const email =
    session.customer_details?.email ||
    session.customer_email ||
    session.metadata?.email;
  let product = resolveProductFromStripe(session);
  if (!product && session.metadata?.product_id) {
    product = getProduct(session.metadata.product_id);
  }
  if (!product) {
    throw new Error(
      "Could not resolve product. Set Stripe Checkout metadata product_id (e.g. shotgun-pack)."
    );
  }
  return fulfillOrder({
    email,
    productId: product.id,
    stripeSessionId: session.id,
    stripePaymentIntent:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id,
    amountCents: session.amount_total,
  });
}

module.exports = {
  fulfillOrder,
  fulfillFromStripeSession,
};
