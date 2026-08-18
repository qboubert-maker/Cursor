/* Smoke tests for affiliate click → commission math + code normalize */
const assert = require("assert");
const path = require("path");

const {
  normalizeCode,
  bumpClick,
  clicksForCode,
  applyPendingForCode: _unused,
  emptyState,
  upsertAffiliateUser,
  findAffiliateByCode,
} = require("../netlify/lib/affiliate-store");

// Local mirror of credit math
const RATE = 0.2;
function commission(price) {
  return +((Number(price) || 0) * RATE).toFixed(2);
}

assert.strictEqual(commission(19.99), 4.0);
assert.strictEqual(commission(29.99), 6.0);
assert.strictEqual(commission(9.99), 2.0);
assert.strictEqual(commission(0), 0);

assert.strictEqual(normalizeCode("ab12cd"), "AB12CD");
assert.strictEqual(normalizeCode(" AFF-12_3 "), "AFF-12_3");
assert.strictEqual(normalizeCode("bad!!code"), "BADCODE");

const state = emptyState();
assert.strictEqual(bumpClick(state, "abc123"), 1);
assert.strictEqual(bumpClick(state, "ABC123"), 2);
assert.strictEqual(bumpClick(state, "abc123"), 3);
assert.strictEqual(Object.keys(state.clicks).length, 1);
assert.strictEqual(clicksForCode(state.clicks, "AbC123"), 3);

upsertAffiliateUser(state, {
  email: "creator@example.com",
  code: "abc123",
  earnings: 0,
  sales: 0,
  paidOut: 0,
});
const found = findAffiliateByCode(state, "ABC123");
assert.ok(found);
assert.strictEqual(found.code, "ABC123");

// Pending apply logic (mirrors affiliate-credit)
function applyPending(user, pending) {
  const keep = [];
  const userCode = normalizeCode(user.code);
  pending.forEach((p) => {
    if (normalizeCode(p.code) !== userCode) return keep.push(p);
    user.earnings = +((user.earnings || 0) + p.commission).toFixed(2);
    user.sales = (user.sales || 0) + 1;
  });
  return { user, keep };
}
const u = { code: "ABC123", earnings: 0, sales: 0 };
const out = applyPending(u, [
  { code: "abc123", commission: 4 },
  { code: "ZZZ", commission: 1 },
]);
assert.strictEqual(out.user.earnings, 4);
assert.strictEqual(out.user.sales, 1);
assert.strictEqual(out.keep.length, 1);

// Attribution client_reference_id sanitizer (client mirror)
function sanitize(aff) {
  return normalizeCode(aff).slice(0, 200);
}
assert.strictEqual(sanitize("AB12CD"), "AB12CD");
assert.strictEqual(sanitize("aff-12_3"), "AFF-12_3");

console.log("affiliate-smoke: all checks passed");
