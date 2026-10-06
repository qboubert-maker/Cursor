/* Shared license key from Stripe session id (same key on thank-you page + webhook email) */
function bdLicenseFromSessionId(sessionId) {
    const crypto = require("crypto");
    const hash = crypto.createHash("sha256").update("bd-v1-" + sessionId).digest("hex");
    const part = (off) => hash.substring(off, off + 4).toUpperCase().replace(/[^A-Z0-9]/g, "X");
    return `BD-${part(0)}-${part(4)}-${part(8)}`;
}

module.exports = { bdLicenseFromSessionId };
