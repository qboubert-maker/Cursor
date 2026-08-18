/* Smoke tests for affiliate click → commission math (no Netlify needed) */
const assert = require("assert");

// Local mirror of credit math
const RATE = 0.2;
function commission(price) {
  return +((Number(price) || 0) * RATE).toFixed(2);
}

assert.strictEqual(commission(19.99), 4.0);
assert.strictEqual(commission(29.99), 6.0);
assert.strictEqual(commission(9.99), 2.0);
assert.strictEqual(commission(0), 0);

// Attribution client_reference_id sanitizer
function sanitize(aff) {
  return String(aff || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 200);
}
assert.strictEqual(sanitize("AB12CD"), "AB12CD");
assert.strictEqual(sanitize("AFF-12_3"), "AFF-12_3");

// Pending apply logic
function applyPending(user, pending) {
  const keep = [];
  pending.forEach((p) => {
    if (p.code !== user.code) return keep.push(p);
    user.earnings = +((user.earnings || 0) + p.commission).toFixed(2);
    user.sales = (user.sales || 0) + 1;
  });
  return { user, keep };
}
const u = { code: "ABC123", earnings: 0, sales: 0 };
const out = applyPending(u, [
  { code: "ABC123", commission: 4 },
  { code: "ZZZ", commission: 1 },
]);
assert.strictEqual(out.user.earnings, 4);
assert.strictEqual(out.user.sales, 1);
assert.strictEqual(out.keep.length, 1);

console.log("affiliate-smoke: all checks passed");
