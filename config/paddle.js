const { Paddle, Environment } = require('@paddle/paddle-node-sdk');

// Initialize Paddle client based on environment
const paddleEnvironment = process.env.PADDLE_ENVIRONMENT === 'production'
    ? Environment.production
    : Environment.sandbox;

const paddle = new Paddle(process.env.PADDLE_API_KEY, {
    environment: paddleEnvironment
});

// Webhook signature verification (Paddle Billing v2 format)
// Paddle v2 sends: ts=TIMESTAMP;h1=HASH
// Signed content is: timestamp:rawBody
const verifyWebhookSignature = (rawBody, signature) => {
    const crypto = require('crypto');
    const secret = process.env.PADDLE_WEBHOOK_SECRET;

    if (!secret) {
        console.warn('[Paddle] PADDLE_WEBHOOK_SECRET not configured — skipping verification');
        return true; // Allow in development; remove this for strict production
    }

    try {
        // Parse Paddle v2 signature format: "ts=1234567890;h1=abc123..."
        const parts = {};
        signature.split(';').forEach(part => {
            const [key, value] = part.split('=');
            parts[key.trim()] = value.trim();
        });

        const ts = parts.ts;
        const h1 = parts.h1;

        if (!ts || !h1) {
            console.error('[Paddle] Invalid signature format. Expected ts=...;h1=..., got:', signature);
            return false;
        }

        // Paddle signs: timestamp:rawBody
        const signedPayload = `${ts}:${rawBody}`;
        const computedHash = crypto
            .createHmac('sha256', secret)
            .update(signedPayload)
            .digest('hex');

        const isValid = crypto.timingSafeEqual(
            Buffer.from(h1),
            Buffer.from(computedHash)
        );

        if (!isValid) {
            console.error('[Paddle] Signature mismatch');
        }

        return isValid;
    } catch (err) {
        console.error('[Paddle] Signature verification error:', err.message);
        return false;
    }
};

// Price ID for Pro plan (Free plan doesn't need a Paddle price)
const PADDLE_PRO_PRICE_ID = process.env.PADDLE_PRO_PRICE_ID;

// Get price ID for a plan
const getPriceIdForPlan = (plan) => {
    if (plan === 'free') {
        return null; // Free plan doesn't have a Paddle price
    }
    if (plan === 'pro') {
        if (!PADDLE_PRO_PRICE_ID) {
            throw new Error('PADDLE_PRO_PRICE_ID is not configured');
        }
        return PADDLE_PRO_PRICE_ID;
    }
    throw new Error(`Unknown plan: ${plan}. Available plans: free, pro`);
};

module.exports = {
    paddle,
    verifyWebhookSignature,
    getPriceIdForPlan,
    PADDLE_PRO_PRICE_ID,
    paddleEnvironment
};
