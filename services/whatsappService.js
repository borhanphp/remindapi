/**
 * WhatsApp delivery service.
 *
 * Supports two providers, picked by which credentials are configured:
 *  - Meta WhatsApp Cloud API: WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_ACCESS_TOKEN
 *  - Twilio WhatsApp:         TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_NUMBER
 *
 * Meta wins if both are configured (template messages work outside the
 * 24-hour session window). Twilio sends freeform bodies, which reach any
 * number in the Twilio sandbox and approved senders in production.
 */

const { formatCurrency } = require('../utils/format');

const META_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const META_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const META_API_VERSION = 'v21.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}/${META_PHONE_NUMBER_ID}/messages`;

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER;

let twilioClient = null;
function getTwilioClient() {
    if (!twilioClient && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
        twilioClient = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    }
    return twilioClient;
}

function isMetaConfigured() {
    return !!(META_PHONE_NUMBER_ID && META_ACCESS_TOKEN);
}

function isTwilioConfigured() {
    return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_NUMBER);
}

function isConfigured() {
    return isMetaConfigured() || isTwilioConfigured();
}

function normalizePhone(phone) {
    if (!phone) return null;
    const cleaned = phone.replace(/[\s\-()]/g, '');
    if (/^\+?\d{10,15}$/.test(cleaned)) {
        return cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
    }
    return null;
}

// ---------------------------------------------------------------------------
// Meta Cloud API
// ---------------------------------------------------------------------------

async function sendMetaTemplate({ to, templateName, templateParams, language = 'en_US' }) {
    const body = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
            name: templateName,
            language: { code: language },
            components: [{
                type: 'body',
                parameters: Object.entries(templateParams).map(([, value]) => ({
                    type: 'text',
                    text: String(value)
                }))
            }]
        }
    };

    const res = await fetch(META_BASE_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const data = await res.json();

    if (!res.ok) {
        console.error('[WhatsApp/Meta] API error:', JSON.stringify(data));
        return { success: false, error: data.error?.message || 'API error' };
    }

    const messageId = data.messages?.[0]?.id;
    console.log(`[WhatsApp/Meta] Template message sent: ${messageId}`);
    return { success: true, messageId };
}

async function sendMetaText({ to, body: messageBody }) {
    const payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: messageBody }
    };

    const res = await fetch(META_BASE_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
        console.error('[WhatsApp/Meta] API error:', JSON.stringify(data));
        return { success: false, error: data.error?.message || 'API error' };
    }

    const messageId = data.messages?.[0]?.id;
    console.log(`[WhatsApp/Meta] Text message sent: ${messageId}`);
    return { success: true, messageId };
}

// ---------------------------------------------------------------------------
// Twilio
// ---------------------------------------------------------------------------

async function sendTwilioText({ to, body: messageBody }) {
    const client = getTwilioClient();
    const from = TWILIO_WHATSAPP_NUMBER.startsWith('whatsapp:')
        ? TWILIO_WHATSAPP_NUMBER
        : `whatsapp:${TWILIO_WHATSAPP_NUMBER}`;

    const message = await client.messages.create({
        from,
        to: `whatsapp:+${to}`,
        body: messageBody
    });

    console.log(`[WhatsApp/Twilio] Message sent: ${message.sid}`);
    return { success: true, messageId: message.sid };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

async function sendWhatsAppText({ to, body: messageBody }) {
    if (!isConfigured()) {
        console.warn('[WhatsApp] Not configured, skipping message');
        return { success: false, error: 'WhatsApp not configured' };
    }

    const phoneNumber = normalizePhone(to);
    if (!phoneNumber) {
        return { success: false, error: 'Invalid phone number' };
    }

    try {
        if (isMetaConfigured()) {
            return await sendMetaText({ to: phoneNumber, body: messageBody });
        }
        return await sendTwilioText({ to: phoneNumber, body: messageBody });
    } catch (err) {
        console.error('[WhatsApp] Send failed:', err.message);
        return { success: false, error: err.message };
    }
}

async function sendWhatsAppTemplate({ to, templateName, templateParams, language = 'en_US', fallbackBody }) {
    if (!isConfigured()) {
        console.warn('[WhatsApp] Not configured, skipping message');
        return { success: false, error: 'WhatsApp not configured' };
    }

    const phoneNumber = normalizePhone(to);
    if (!phoneNumber) {
        return { success: false, error: 'Invalid phone number' };
    }

    try {
        if (isMetaConfigured()) {
            return await sendMetaTemplate({ to: phoneNumber, templateName, templateParams, language });
        }
        // Twilio has no equivalent of Meta's named templates here; send the
        // freeform fallback body instead.
        if (!fallbackBody) {
            return { success: false, error: 'No fallback body for non-template provider' };
        }
        return await sendTwilioText({ to: phoneNumber, body: fallbackBody });
    } catch (err) {
        console.error('[WhatsApp] Send failed:', err.message);
        return { success: false, error: err.message };
    }
}

function buildReminderBody({ clientName, companyName, invoiceNumber, amount, currency, dueDate, paymentLink, reminderType }) {
    const ref = invoiceNumber ? ` #${invoiceNumber}` : '';
    const money = formatCurrency(amount, currency);
    const from = companyName ? `\n\nFrom: ${companyName}` : '';
    const intro = {
        before_due: `Hi ${clientName}, a friendly reminder: invoice${ref} for ${money} is due on ${dueDate}.`,
        on_due: `Hi ${clientName}, invoice${ref} for ${money} is due today (${dueDate}).`,
        after_due: `Hi ${clientName}, invoice${ref} for ${money} was due on ${dueDate} and is now overdue. Please pay as soon as possible.`,
        manual: `Hi ${clientName}, a friendly reminder about invoice${ref} for ${money}, due ${dueDate}.`
    };
    const key = reminderType && reminderType.startsWith('after_due') ? 'after_due' : reminderType;
    let body = intro[key] || intro.manual;
    body += from;
    body += paymentLink
        ? `\n\nView or pay here: ${paymentLink}`
        : '\n\nPlease contact the sender for payment details.';
    return body;
}

async function sendInvoiceReminder({ to, clientName, companyName, invoiceNumber, amount, currency, dueDate, paymentLink, reminderType }) {
    const templateMap = {
        before_due: 'invoice_reminder_upcoming',
        on_due: 'invoice_reminder_due_today',
        after_due: 'invoice_reminder_overdue',
        manual: 'invoice_reminder_manual'
    };

    const normalizedType = reminderType && reminderType.startsWith('after_due') ? 'after_due' : reminderType;
    const templateName = templateMap[normalizedType] || 'invoice_reminder_manual';

    return sendWhatsAppTemplate({
        to,
        templateName,
        templateParams: {
            client_name: clientName,
            company_name: companyName || 'N/A',
            invoice_number: invoiceNumber || 'N/A',
            amount: formatCurrency(amount, currency),
            due_date: dueDate,
            payment_link: paymentLink || 'Contact sender for details'
        },
        fallbackBody: buildReminderBody({ clientName, companyName, invoiceNumber, amount, currency, dueDate, paymentLink, reminderType })
    });
}

module.exports = {
    isConfigured,
    sendWhatsAppTemplate,
    sendWhatsAppText,
    sendInvoiceReminder
};
