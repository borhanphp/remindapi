const crypto = require('crypto');

function getSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET environment variable is not set');
    return secret;
}

function generatePortalToken(invoiceId) {
    return crypto
        .createHmac('sha256', getSecret())
        .update(invoiceId.toString())
        .digest('hex')
        .slice(0, 32);
}

function verifyPortalToken(invoiceId, token) {
    const expected = generatePortalToken(invoiceId);
    if (expected.length !== token.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

module.exports = { generatePortalToken, verifyPortalToken };
