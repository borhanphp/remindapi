const crypto = require('crypto');

// Random, per-invoice tokens: unlike the previous HMAC(invoiceId) scheme they
// are not derivable from the invoice id, and can be rotated if a link leaks.
function generatePortalToken() {
    return crypto.randomBytes(16).toString('hex');
}

module.exports = { generatePortalToken };
