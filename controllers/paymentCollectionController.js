const InvoiceReminder = require('../models/InvoiceReminder');
const User = require('../models/User');
const { dispatch: dispatchWebhook } = require('../services/webhookService');
const paypal = require('../services/paypalService');

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
          invoice.paymentClaim = undefined;
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

exports.createPaypalOrder = async (req, res) => {
  try {
    const { token } = req.params;
    const invoice = await InvoiceReminder.findOne({ portalToken: token });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.status === 'paid') return res.status(400).json({ error: 'Invoice already paid' });

    if (!paypal.isConfigured()) {
      return res.status(503).json({ error: 'PayPal not configured' });
    }

    const totalAmount = invoice.amount + (invoice.lateFee?.amount || 0) - (invoice.paidAmount || 0);
    if (totalAmount <= 0) return res.status(400).json({ error: 'Nothing due on this invoice' });

    const order = await paypal.createOrder({
      amount: totalAmount,
      currency: invoice.currency,
      description: `Invoice ${invoice.invoiceNumber || '#' + invoice._id.toString().slice(-6)}`,
      referenceId: invoice._id.toString(),
    });

    invoice.paypalOrderId = order.id;
    await invoice.save();

    res.json({ success: true, orderId: order.id });
  } catch (err) {
    console.error('[PayPal] Order creation error:', err.message);
    res.status(500).json({ error: 'Failed to create PayPal order' });
  }
};

exports.capturePaypalOrder = async (req, res) => {
  try {
    const { token } = req.params;
    const { orderId } = req.body || {};
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });

    const invoice = await InvoiceReminder.findOne({ portalToken: token });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.status === 'paid') return res.json({ success: true, message: 'Invoice already paid' });

    // Only capture the order this invoice created — prevents replaying a
    // capture from a different (cheaper) invoice
    if (!invoice.paypalOrderId || invoice.paypalOrderId !== orderId) {
      return res.status(400).json({ error: 'Order does not match this invoice' });
    }

    const result = await paypal.captureOrder(orderId);
    if (!result.completed) {
      return res.status(402).json({ error: 'Payment was not completed' });
    }

    invoice.status = 'paid';
    invoice.paidAt = new Date();
    invoice.paidAmount = (invoice.paidAmount || 0) + (result.amount || 0);
    invoice.paymentMethod = 'paypal';
    invoice.paymentClaim = undefined;
    await invoice.save();

    const user = await User.findById(invoice.userId);
    if (user?.organization) {
      dispatchWebhook(user.organization, 'invoice.paid', {
        invoiceId: invoice._id,
        clientName: invoice.clientName,
        amount: result.amount,
        currency: result.currency,
        paymentMethod: 'paypal',
      }).catch(() => {});
    }

    res.json({ success: true, message: 'Payment received. Thank you!' });
  } catch (err) {
    console.error('[PayPal] Capture error:', err.message);
    res.status(500).json({ error: 'Failed to capture PayPal payment' });
  }
};

exports.getPaymentConfig = async (req, res) => {
  try {
    const { token } = req.params;
    const invoice = await InvoiceReminder.findOne({ portalToken: token });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const stripeEnabled = !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_PUBLISHABLE_KEY;
    const paypalEnabled = paypal.isConfigured();

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
