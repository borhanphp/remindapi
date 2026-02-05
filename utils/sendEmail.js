const nodemailer = require('nodemailer');
const { Resend } = require('resend');

// Initialize Resend if API key is configured
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Cache for nodemailer transporter (fallback)
let cachedTransporter = null;
let cachedTestAccount = null;
let transporterCreatedAt = null;
const TRANSPORTER_TTL = 3600000; // 1 hour

/**
 * Send email via Resend (primary method)
 * Much faster and more reliable than Gmail
 */
const sendViaResend = async (options) => {
  const fromEmail = options.from || process.env.FROM_EMAIL || 'onboarding@resend.dev';
  const fromName = process.env.FROM_NAME || 'Zeeventory';

  try {
    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
      reply_to: options.replyTo || fromEmail,
    });

    if (error) {
      console.error('❌ Resend error:', error);
      throw new Error(error.message);
    }

    console.log('✅ Email sent via Resend:', data.id);
    return { messageId: data.id };
  } catch (error) {
    console.error('❌ Resend failed:', error.message);
    throw error;
  }
};

/**
 * Get or create nodemailer transporter (fallback)
 */
const getNodemailerTransporter = async () => {
  const now = Date.now();

  if (cachedTransporter && transporterCreatedAt && (now - transporterCreatedAt < TRANSPORTER_TTL)) {
    return cachedTransporter;
  }

  const isEmailConfigured = process.env.EMAIL_USERNAME && process.env.EMAIL_PASSWORD;

  if (isEmailConfigured) {
    cachedTransporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
    transporterCreatedAt = now;
    return cachedTransporter;
  }

  // Development - use cached Ethereal Email account
  if (!cachedTestAccount) {
    try {
      console.log('🔧 Creating Ethereal test email account (one-time)...');
      cachedTestAccount = await nodemailer.createTestAccount();
      console.log('✅ Ethereal account created:', cachedTestAccount.user);
    } catch (error) {
      console.warn('⚠️ Could not create Ethereal account:', error.message);
      return null;
    }
  }

  cachedTransporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: cachedTestAccount.user,
      pass: cachedTestAccount.pass,
    },
  });
  transporterCreatedAt = now;
  return cachedTransporter;
};

/**
 * Send email via Nodemailer (fallback method)
 */
const sendViaNodemailer = async (options) => {
  const transporter = await getNodemailerTransporter();

  if (!transporter) {
    console.log('📧 EMAIL SIMULATION (no transporter):');
    console.log('To:', options.to);
    console.log('Subject:', options.subject);
    console.log('---');
    return { messageId: 'simulated-' + Date.now() };
  }

  const message = {
    from: options.from || `${process.env.FROM_NAME || 'Zeeventory'} <${process.env.FROM_EMAIL || 'noreply@zeeventory.com'}>`,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    replyTo: options.replyTo || options.from || process.env.FROM_EMAIL
  };

  const info = await transporter.sendMail(message);

  if (process.env.NODE_ENV !== 'production' && !process.env.EMAIL_USERNAME) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('📩 Preview URL:', previewUrl);
    }
  }

  console.log('✅ Email sent via Nodemailer:', info.messageId);
  return info;
};

/**
 * Send email - Uses Resend if configured, falls back to Nodemailer/Gmail
 * 
 * Priority:
 * 1. Resend (if RESEND_API_KEY set) - fastest, recommended
 * 2. Gmail/SMTP (if EMAIL_USERNAME set) - fallback
 * 3. Ethereal (dev only) - for testing
 * 4. Console log - last resort
 */
const sendEmail = async (options) => {
  // Try Resend first (faster, more reliable)
  if (resend) {
    try {
      return await sendViaResend(options);
    } catch (error) {
      console.warn('⚠️ Resend failed, falling back to Nodemailer:', error.message);
      // Fall through to nodemailer
    }
  }

  // Fallback to Nodemailer (Gmail/SMTP/Ethereal)
  try {
    return await sendViaNodemailer(options);
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    throw error;
  }
};

module.exports = sendEmail;
