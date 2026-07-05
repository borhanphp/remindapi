/**
 * PayPal Orders v2 integration for the client pay portal.
 *
 * Env:
 *   PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET — REST app credentials
 *   PAYPAL_ENVIRONMENT — 'live' or 'sandbox' (default sandbox)
 *
 * Payments are only trusted after a server-side capture returns COMPLETED —
 * the client never tells us the outcome directly.
 */

const BASE_URL = process.env.PAYPAL_ENVIRONMENT === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

function isConfigured() {
    return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
    if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
        return cachedToken;
    }

    const auth = Buffer.from(
        `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString('base64');

    const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(`PayPal auth failed: ${data.error_description || res.status}`);
    }

    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in || 300) * 1000;
    return cachedToken;
}

/**
 * Create an order for the given amount. Returns the PayPal order id the
 * frontend passes to the PayPal Buttons SDK.
 */
async function createOrder({ amount, currency = 'USD', description, referenceId }) {
    const token = await getAccessToken();

    const res = await fetch(`${BASE_URL}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [{
                reference_id: referenceId,
                description: (description || 'Invoice payment').slice(0, 127),
                amount: {
                    currency_code: (currency || 'USD').toUpperCase(),
                    value: Number(amount).toFixed(2)
                }
            }]
        })
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(`PayPal order creation failed: ${data.message || res.status}`);
    }
    return data; // { id, status, ... }
}

/**
 * Capture an approved order. Returns { completed, amount, currency, raw }.
 */
async function captureOrder(orderId) {
    const token = await getAccessToken();

    const res = await fetch(`${BASE_URL}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(`PayPal capture failed: ${data.message || res.status}`);
    }

    const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
    return {
        completed: data.status === 'COMPLETED' && capture?.status === 'COMPLETED',
        amount: capture ? Number(capture.amount?.value) : null,
        currency: capture?.amount?.currency_code || null,
        captureId: capture?.id || null,
        raw: data
    };
}

module.exports = { isConfigured, createOrder, captureOrder };
