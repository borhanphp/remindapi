const InvoiceReminder = require('../models/InvoiceReminder');
const Client = require('../models/Client');
const { dispatch: dispatchWebhook } = require('../services/webhookService');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const { escapeHtml, formatCurrency } = require('../utils/format');

exports.getInvoiceForClient = async (req, res) => {
    try {
        const invoice = await InvoiceReminder.findOne({
            portalToken: req.params.token
        }).populate('userId', 'name companyName plan subscriptionStatus');

        if (!invoice) {
            return res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
        }

        const viewUpdate = { $inc: { viewCount: 1 } };
        if (!invoice.viewedAt) {
            viewUpdate.$set = { viewedAt: new Date() };
        }
        await InvoiceReminder.updateOne({ _id: invoice._id }, viewUpdate);

        const owner = await User.findById(invoice.userId._id || invoice.userId).select('organization');
        if (owner?.organization) {
            dispatchWebhook(owner.organization, 'invoice.viewed', {
                _id: invoice._id,
                clientName: invoice.clientName,
                invoiceNumber: invoice.invoiceNumber,
                viewCount: invoice.viewCount,
                viewedAt: invoice.viewedAt
            }).catch(() => {});
        }

        const isPro = invoice.userId?.plan === 'pro' ||
            invoice.userId?.subscriptionStatus === 'trialing';

        const lateFeeAmount = invoice.lateFee?.applied ? invoice.lateFee.amount : 0;
        const totalDue = invoice.amount + lateFeeAmount - (invoice.paidAmount || 0);

        const stripeEnabled = !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_PUBLISHABLE_KEY;
        const paypalEnabled = !!process.env.PAYPAL_CLIENT_ID && !!process.env.PAYPAL_CLIENT_SECRET;

        res.status(200).json({
            success: true,
            data: {
                clientName: invoice.clientName,
                invoiceNumber: invoice.invoiceNumber,
                amount: invoice.amount,
                currency: invoice.currency || 'USD',
                lateFee: lateFeeAmount,
                paidAmount: invoice.paidAmount || 0,
                totalDue,
                dueDate: invoice.dueDate,
                status: invoice.status,
                paymentClaimed: !!invoice.paymentClaim?.claimedAt,
                paymentLink: invoice.paymentLink,
                companyName: invoice.userId?.companyName || invoice.userId?.name || 'Unknown',
                showBranding: !isPro,
                canPayOnline: stripeEnabled || paypalEnabled,
                stripeEnabled,
                paypalEnabled,
                paypalClientId: paypalEnabled ? process.env.PAYPAL_CLIENT_ID : null,
            }
        });
    } catch (err) {
        console.error('[Portal] Error fetching invoice:', err);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

/**
 * Client claims they've paid (e.g. by bank transfer). This records the claim
 * and notifies the owner — it does NOT mark the invoice paid; only the owner
 * (or a verified Stripe/PayPal payment) can do that.
 */
exports.markClientPaid = async (req, res) => {
    try {
        const invoice = await InvoiceReminder.findOne({
            portalToken: req.params.token
        });

        if (!invoice) {
            return res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
        }

        if (invoice.status === 'paid') {
            return res.status(200).json({
                success: true,
                message: 'Invoice is already marked as paid'
            });
        }

        if (invoice.paymentClaim?.claimedAt) {
            return res.status(200).json({
                success: true,
                message: 'Thanks — your payment has already been reported and is awaiting confirmation.'
            });
        }

        const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 500) : undefined;
        invoice.paymentClaim = { claimedAt: new Date(), note };
        await invoice.save();

        const owner = await User.findById(invoice.userId).select('organization email name companyName');

        if (owner?.organization) {
            dispatchWebhook(owner.organization, 'invoice.payment_claimed', {
                _id: invoice._id,
                clientName: invoice.clientName,
                invoiceNumber: invoice.invoiceNumber,
                amount: invoice.amount,
                currency: invoice.currency,
                claimedAt: invoice.paymentClaim.claimedAt,
                note
            }).catch(() => {});
        }

        // Notify the owner so they can confirm from the dashboard
        if (owner?.email) {
            const ref = invoice.invoiceNumber ? ` #${invoice.invoiceNumber}` : '';
            const money = formatCurrency(invoice.amount, invoice.currency);
            sendEmail({
                to: owner.email,
                subject: `Payment reported for invoice${ref}`,
                text: `${invoice.clientName} reported that invoice${ref} for ${money} has been paid.` +
                    (note ? `\n\nNote from client: ${note}` : '') +
                    `\n\nConfirm the payment from your ZeeRemind dashboard to mark the invoice as paid.`,
                html: `<p><strong>${escapeHtml(invoice.clientName)}</strong> reported that invoice${escapeHtml(ref)} for <strong>${escapeHtml(money)}</strong> has been paid.</p>` +
                    (note ? `<p>Note from client: ${escapeHtml(note)}</p>` : '') +
                    `<p>Confirm the payment from your ZeeRemind dashboard to mark the invoice as paid.</p>`
            }).catch(err => console.error('[Portal] Owner claim notification failed:', err.message));
        }

        res.status(200).json({
            success: true,
            message: 'Thanks! The sender has been notified and will confirm your payment.'
        });
    } catch (err) {
        console.error('[Portal] Error recording payment claim:', err);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

/**
 * Recipient unsubscribes from reminder emails for this sender.
 * Keyed by organization + email, so it covers all their invoices.
 */
exports.unsubscribe = async (req, res) => {
    try {
        const invoice = await InvoiceReminder.findOne({ portalToken: req.params.token });

        if (!invoice) {
            return res.status(404).json({ success: false, error: 'Invalid unsubscribe link' });
        }

        const owner = await User.findById(invoice.userId).select('organization');
        if (!owner?.organization) {
            return res.status(404).json({ success: false, error: 'Invalid unsubscribe link' });
        }

        await Client.findOneAndUpdate(
            { organization: owner.organization, email: invoice.clientEmail.toLowerCase() },
            {
                $set: { emailOptOut: true, emailOptOutAt: new Date() },
                $setOnInsert: {
                    organization: owner.organization,
                    userId: invoice.userId,
                    name: invoice.clientName,
                    email: invoice.clientEmail.toLowerCase()
                }
            },
            { upsert: true }
        );

        res.status(200).json({
            success: true,
            message: 'You have been unsubscribed from payment reminder emails for this sender.'
        });
    } catch (err) {
        console.error('[Portal] Unsubscribe error:', err);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};
