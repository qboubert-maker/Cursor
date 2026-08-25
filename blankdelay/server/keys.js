const crypto = require("crypto");
const db = require("./db");
const { getProduct } = require("./products");

function generateKeyCode(productId) {
  const prefix = (productId || "BLANK")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
  const chunks = [prefix];
  for (let i = 0; i < 3; i++) {
    chunks.push(crypto.randomBytes(2).toString("hex").toUpperCase());
  }
  return chunks.join("-");
}

/** Create N unused keys for a product */
function createKeys(productId, count = 1) {
  if (!getProduct(productId)) throw new Error(`Unknown product: ${productId}`);
  const insert = db.prepare(
    `INSERT INTO license_keys (key_code, product_id, status) VALUES (?, ?, 'available')`
  );
  const created = [];
  const tx = db.transaction(() => {
    for (let i = 0; i < count; i++) {
      let code;
      for (let attempt = 0; attempt < 5; attempt++) {
        code = generateKeyCode(productId);
        try {
          insert.run(code, productId);
          created.push(code);
          break;
        } catch (e) {
          if (attempt === 4) throw e;
        }
      }
    }
  });
  tx();
  return created;
}

/** Assign one available key to a buyer (creates one if stock empty) */
function assignKey({ productId, email, stripeSessionId, stripePaymentIntent }) {
  const existing = db
    .prepare(
      `SELECT key_code FROM license_keys
       WHERE stripe_session_id = ? OR (email = ? AND product_id = ? AND status = 'assigned')
       ORDER BY id DESC LIMIT 1`
    )
    .get(stripeSessionId || "", email || "", productId);

  if (existing) return existing.key_code;

  let row = db
    .prepare(
      `SELECT id, key_code FROM license_keys
       WHERE product_id = ? AND status = 'available'
       ORDER BY id ASC LIMIT 1`
    )
    .get(productId);

  if (!row) {
    createKeys(productId, 1);
    row = db
      .prepare(
        `SELECT id, key_code FROM license_keys
         WHERE product_id = ? AND status = 'available'
         ORDER BY id ASC LIMIT 1`
      )
      .get(productId);
  }

  db.prepare(
    `UPDATE license_keys
     SET status = 'assigned', email = ?, stripe_session_id = ?,
         stripe_payment_intent = ?, assigned_at = datetime('now')
     WHERE id = ?`
  ).run(email || null, stripeSessionId || null, stripePaymentIntent || null, row.id);

  return row.key_code;
}

function validateKey(keyCode) {
  const row = db
    .prepare(`SELECT * FROM license_keys WHERE key_code = ?`)
    .get(keyCode.trim().toUpperCase());
  if (!row) return { valid: false, reason: "invalid" };
  if (row.status === "revoked") return { valid: false, reason: "revoked", productId: row.product_id };
  return {
    valid: true,
    productId: row.product_id,
    status: row.status,
    email: row.email,
  };
}

function redeemKey(keyCode) {
  const key = keyCode.trim().toUpperCase();
  const row = db.prepare(`SELECT * FROM license_keys WHERE key_code = ?`).get(key);
  if (!row) return { ok: false, reason: "invalid" };
  if (row.status === "revoked") return { ok: false, reason: "revoked" };
  db.prepare(
    `UPDATE license_keys SET status = 'redeemed', redeemed_at = datetime('now') WHERE key_code = ?`
  ).run(key);
  return { ok: true, productId: row.product_id, key: key };
}

function stockCounts() {
  return db
    .prepare(
      `SELECT product_id,
              SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) AS available,
              SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) AS assigned,
              SUM(CASE WHEN status = 'redeemed' THEN 1 ELSE 0 END) AS redeemed
       FROM license_keys GROUP BY product_id`
    )
    .all();
}

function findByEmail(email) {
  return db
    .prepare(
      `SELECT key_code, product_id, status, assigned_at
       FROM license_keys WHERE lower(email) = lower(?) ORDER BY id DESC`
    )
    .all(email);
}

module.exports = {
  generateKeyCode,
  createKeys,
  assignKey,
  validateKey,
  redeemKey,
  stockCounts,
  findByEmail,
};
