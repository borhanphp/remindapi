const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const API_VERSION = 'v21.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;

function isConfigured() {
    return !!(PHONE_NUMBER_ID && ACCESS_TOKEN);
}

async function sendWhatsAppTemplate({ to, templateName, templateParams, language = 'en_US' }) {
    if (!isConfigured()) {
        console.warn('[WhatsApp] Not configured, skipping message');
        return { success: false, error: 'WhatsApp not configured' };
    }

    const phoneNumber = normalizePhone(to);
    if (!phoneNumber) {
        return { success: false, error: 'Invalid phone number' };
    }

    try {
        const body = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'template',
            template: {
                name: templateName,
                language: { code: language },
                components: [{
                    type: 'body',
                    parameters: templateParams.map(value => ({
                        type: 'text',
                        text: String(value)
                    }))
                }]
            }
        };

        const res = await fetch(BASE_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await res.json();

        if (!res.ok) {
            console.error('[WhatsApp] API error:', JSON.stringify(data));
            return { success: false, error: data.error?.message || 'API error' };
        }

        const messageId = data.messages?.[0]?.id;
        console.log(`[WhatsApp] Template message sent: ${messageId}`);
        return { success: true, messageId };
    } catch (err) {
        console.error('[WhatsApp] Send failed:', err.message);
        return { success: false, error: err.message };
    }
}

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
        const payload = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'text',
            text: { body: messageBody }
        };

        const res = await fetch(BASE_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) {
            console.error('[WhatsApp] API error:', JSON.stringify(data));
            return { success: false, error: data.error?.message || 'API error' };
        }

        const messageId = data.messages?.[0]?.id;
        console.log(`[WhatsApp] Text message sent: ${messageId}`);
        return { success: true, messageId };
    } catch (err) {
        console.error('[WhatsApp] Send failed:', err.message);
        return { success: false, error: err.message };
    }
}

function normalizePhone(phone) {
    if (!phone) return null;
    const cleaned = phone.replace(/[\s\-()]/g, '');
    if (/^\+?\d{10,15}$/.test(cleaned)) {
        return cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
    }
    return null;
}

async function sendInvoiceReminder({ to, clientName, invoiceNumber, amount, dueDate, paymentLink, reminderType }) {
    const templateMap = {
        before_due: 'invoice_reminder_upcoming',
        on_due: 'invoice_reminder_due_today',
        after_due: 'invoice_reminder_overdue',
        manual: 'invoice_reminder_manual'
    };

    const templateName = templateMap[reminderType] || 'invoice_reminder_manual';

    return sendWhatsAppTemplate({
        to,
        templateName,
        templateParams: [
            clientName,
            invoiceNumber || 'N/A',
            `$${Number(amount).toLocaleString()}`,
            dueDate,
            paymentLink || 'Contact sender for details'
        ]
    });
}

module.exports = {
    isConfigured,
    sendWhatsAppTemplate,
    sendWhatsAppText,
    sendInvoiceReminder
};
