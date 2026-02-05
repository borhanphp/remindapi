const { Paddle, Environment } = require('@paddle/paddle-node-sdk');

// Initialize Paddle client based on environment
const paddleEnvironment = process.env.PADDLE_ENVIRONMENT === 'production'
    ? Environment.production
    : Environment.sandbox;

const paddle = new Paddle(process.env.PADDLE_API_KEY, {
    environment: paddleEnvironment
});

// Webhook signature verification
const verifyWebhookSignature = (rawBody, signature) => {
    const crypto = require('crypto');
    const secret = process.env.PADDLE_WEBHOOK_SECRET;

    if (!secret) {
        throw new Error('PADDLE_WEBHOOK_SECRET is not configured');
    }

    const computedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(computedSignature)
    );
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
