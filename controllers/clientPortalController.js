const InvoiceReminder = require('../models/InvoiceReminder');
const { dispatch: dispatchWebhook } = require('../services/webhookService');
const User = require('../models/User');

exports.getInvoiceForClient = async (req, res) => {
    try {
        const invoice = await InvoiceReminder.findOne({
            portalToken: req.params.token
        }).populate('userId', 'name companyName');

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
        const paypalEnabled = !!process.env.PAYPAL_CLIENT_ID;

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

        invoice.status = 'paid';
        invoice.paidAt = new Date();
        invoice.paidAmount = invoice.amount + (invoice.lateFee?.applied ? invoice.lateFee.amount : 0);
        invoice.paymentMethod = 'portal';
        await invoice.save();

        const paidOwner = await User.findById(invoice.userId).select('organization');
        if (paidOwner?.organization) {
            dispatchWebhook(paidOwner.organization, 'invoice.paid', invoice.toObject()).catch(() => {});
        }

        res.status(200).json({
            success: true,
            message: 'Invoice marked as paid. Thank you!'
        });
    } catch (err) {
        console.error('[Portal] Error marking paid:', err);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};
