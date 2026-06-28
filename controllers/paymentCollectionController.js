const InvoiceReminder = require('../models/InvoiceReminder');
const User = require('../models/User');
const { dispatchWebhook } = require('../services/webhookService');

let stripe;
function getStripe() {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

exports.createCheckoutSession = async (req, res) => {
  try {
    const { token } = req.params;
    const invoice = await InvoiceReminder.findOne({ portalToken: token });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.status === 'paid') return res.status(400).json({ error: 'Invoice already paid' });

    const s = getStripe();
    if (!s) return res.status(503).json({ error: 'Payment processing not configured' });

    const user = await User.findById(invoice.userId);
    const companyName = user?.companyName || user?.name || 'Invoice';

    const totalAmount = invoice.amount + (invoice.lateFee?.amount || 0) - (invoice.paidAmount || 0);

    const session = await s.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: (invoice.currency || 'usd').toLowerCase(),
            product_data: {
              name: `Invoice ${invoice.invoiceNumber || '#' + invoice._id.toString().slice(-6)}`,
              description: `Payment to ${companyName}`,
            },
            unit_amount: Math.round(totalAmount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        invoiceId: invoice._id.toString(),
        portalToken: token,
      },
      success_url: `${process.env.FRONTEND_URL}/pay/${token}?payment=success`,
      cancel_url: `${process.env.FRONTEND_URL}/pay/${token}?payment=cancelled`,
    });

    res.json({ success: true, url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[Payment] Checkout error:', err.message);
    res.status(500).json({ error: 'Failed to create payment session' });
  }
};

exports.stripeWebhook = async (req, res) => {
  const s = getStripe();
  if (!s) return res.status(503).send('Stripe not configured');

  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = s.webhooks.constructEvent(req.rawBody || req.body, sig, endpointSecret);
  } catch (err) {
    console.error('[Stripe Webhook] Signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { invoiceId, portalToken } = session.metadata || {};

    if (invoiceId) {
      try {
        const invoice = await InvoiceReminder.findById(invoiceId);
        if (invoice && invoice.status !== 'paid') {
          invoice.status = 'paid';
          invoice.paidAt = new Date();
          invoice.paidAmount = session.amount_total / 100;
          invoice.paymentMethod = 'stripe';
          invoice.stripePaymentIntentId = session.payment_intent;
          await invoice.save();

          const user = await User.findById(invoice.userId);
          if (user?.organization) {
            dispatchWebhook(user.organization, 'invoice.paid', {
              invoiceId: invoice._id,
              clientName: invoice.clientName,
              amount: invoice.paidAmount,
              paymentMethod: 'stripe',
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.error('[Stripe Webhook] Failed to process payment:', err.message);
      }
    }
  }

  res.json({ received: true });
};

exports.getPaymentConfig = async (req, res) => {
  try {
    const { token } = req.params;
    const invoice = await InvoiceReminder.findOne({ portalToken: token });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const stripeEnabled = !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_PUBLISHABLE_KEY;
    const paypalEnabled = !!process.env.PAYPAL_CLIENT_ID;

    res.json({
      success: true,
      data: {
        stripeEnabled,
        paypalEnabled,
        stripePublishableKey: stripeEnabled ? process.env.STRIPE_PUBLISHABLE_KEY : null,
        paypalClientId: paypalEnabled ? process.env.PAYPAL_CLIENT_ID : null,
      },
    });
  } catch (err) {
    console.error('[Payment] Config error:', err.message);
    res.status(500).json({ error: 'Failed to load payment configuration' });
  }
};
