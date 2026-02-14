/**
 * SMS & WhatsApp Service via Twilio
 * 
 * Sends SMS and WhatsApp messages using the Twilio SDK.
 * Falls back to console logging if Twilio credentials are not configured.
 */

let twilioClient = null;

// Lazy-init Twilio client
const getTwilioClient = () => {
  if (twilioClient) return twilioClient;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return null;
  }

  try {
    const twilio = require('twilio');
    twilioClient = twilio(accountSid, authToken);
    return twilioClient;
  } catch (err) {
    console.error('❌ Failed to initialize Twilio client:', err.message);
    return null;
  }
};

/**
 * Send an SMS message
 * @param {Object} options
 * @param {string} options.to - Recipient phone number in E.164 format (e.g. +1234567890)
 * @param {string} options.body - Message text (max 1600 chars)
 * @returns {Promise<{success: boolean, sid?: string, error?: string}>}
 */
const sendSMS = async ({ to, body }) => {
  const client = getTwilioClient();
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!client || !fromNumber) {
    console.log('📱 SMS SIMULATION (no Twilio credentials):');
    console.log(`  To: ${to}`);
    console.log(`  Body: ${body}`);
    console.log('---');
    return { success: true, sid: 'simulated-sms-' + Date.now() };
  }

  try {
    const message = await client.messages.create({
      body: body.substring(0, 1600), // Twilio SMS limit
      from: fromNumber,
      to: to,
    });

    console.log(`✅ SMS sent: ${message.sid}`);
    return { success: true, sid: message.sid };
  } catch (err) {
    console.error(`❌ SMS failed to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Send a WhatsApp message
 * @param {Object} options
 * @param {string} options.to - Recipient phone number in E.164 format (e.g. +1234567890)
 * @param {string} options.body - Message text
 * @returns {Promise<{success: boolean, sid?: string, error?: string}>}
 */
const sendWhatsApp = async ({ to, body }) => {
  const client = getTwilioClient();
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

  if (!client) {
    console.log('💬 WhatsApp SIMULATION (no Twilio credentials):');
    console.log(`  To: ${to}`);
    console.log(`  Body: ${body}`);
    console.log('---');
    return { success: true, sid: 'simulated-wa-' + Date.now() };
  }

  try {
    // Twilio WhatsApp requires the whatsapp: prefix
    const toWhatsApp = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const fromWhatsApp = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;

    const message = await client.messages.create({
      body: body,
      from: fromWhatsApp,
      to: toWhatsApp,
    });

    console.log(`✅ WhatsApp sent: ${message.sid}`);
    return { success: true, sid: message.sid };
  } catch (err) {
    console.error(`❌ WhatsApp failed to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Send a reminder via a specific channel
 * @param {string} channel - 'email', 'sms', or 'whatsapp'
 * @param {Object} options - Channel-specific options
 * @returns {Promise<{success: boolean, sid?: string, error?: string}>}
 */
const sendViaChannel = async (channel, { to, body, emailOptions }) => {
  switch (channel) {
    case 'sms':
      return sendSMS({ to, body });
    case 'whatsapp':
      return sendWhatsApp({ to, body });
    case 'email':
      // Email is handled by the existing notify.js / sendEmail.js
      if (emailOptions) {
        const { sendEmail } = require('../utils/notify');
        await sendEmail(emailOptions);
        return { success: true };
      }
      return { success: false, error: 'No email options provided' };
    default:
      return { success: false, error: `Unknown channel: ${channel}` };
  }
};

module.exports = { sendSMS, sendWhatsApp, sendViaChannel };
