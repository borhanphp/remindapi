const express = require('express');
const router = express.Router();

// ─────────────────────────────────────────────
// Meta WhatsApp Webhook Verification & Receiver
// ─────────────────────────────────────────────

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'zeeremind_whatsapp_verify';

/**
 * GET /api/whatsapp/webhook
 * Meta sends a GET request to verify the webhook URL.
 * It expects us to echo back the hub.challenge value.
 */
router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('[WhatsApp Webhook] Verification successful');
        return res.status(200).send(challenge);
    }

    console.warn('[WhatsApp Webhook] Verification failed - invalid token');
    return res.sendStatus(403);
});

/**
 * POST /api/whatsapp/webhook
 * Receives incoming message notifications and delivery status updates from Meta.
 * For now we just acknowledge them (200 OK) to avoid Meta retrying.
 */
router.post('/webhook', (req, res) => {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
        // Process each entry
        (body.entry || []).forEach(entry => {
            const changes = entry.changes || [];
            changes.forEach(change => {
                const value = change.value;

                // Delivery status updates (sent, delivered, read, failed)
                if (value.statuses) {
                    value.statuses.forEach(status => {
                        console.log(`[WhatsApp Webhook] Message ${status.id} status: ${status.status}`);
                    });
                }

                // Incoming messages (optional - for future use)
                if (value.messages) {
                    value.messages.forEach(msg => {
                        console.log(`[WhatsApp Webhook] Incoming message from ${msg.from}: ${msg.type}`);
                    });
                }
            });
        });

        // Always return 200 to acknowledge receipt
        return res.sendStatus(200);
    }

    // Not a WhatsApp event
    res.sendStatus(404);
});

module.exports = router;
