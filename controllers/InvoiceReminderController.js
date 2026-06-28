const InvoiceReminder = require('../models/InvoiceReminder');
const InvoiceReminderLog = require('../models/InvoiceReminderLog');
const InvoiceSettings = require('../models/InvoiceSettings');
const Client = require('../models/Client');
const { generatePortalToken } = require('../utils/portalToken');
const { dispatch: dispatchWebhook } = require('../services/webhookService');

const ALLOWED_CHANNELS = ['email', 'whatsapp'];

function normalizeReminderChannels(channels, userPlan = 'free') {
    if (!Array.isArray(channels) || channels.length === 0) {
        return ['email'];
    }
    const valid = channels.filter(c => ALLOWED_CHANNELS.includes(c));
    if (userPlan !== 'pro') {
        return valid.filter(c => c === 'email');
    }
    return valid.length > 0 ? valid : ['email'];
}

/**
 * @desc    Create a new invoice
 * @route   POST /api/invoice-reminder/invoices
 * @access  Private
 */
exports.createInvoice = async (req, res) => {
    try {
        const { clientName, clientEmail, clientPhone, amount, dueDate, paymentLink, invoiceNumber, reminderChannels } = req.body;

        // Feature Gating: Check Plan Limits
        const user = req.user; // Assumes auth middleware populates this
        if (user.plan === 'free') {
            // Lifetime Limit check (no date filter)
            const invoiceCount = await InvoiceReminder.countDocuments({
                userId: user._id,
                status: { $ne: 'paid' }
            });

            if (invoiceCount >= 3) {
                // Detect if user was previously on Pro (has more invoices than free limit)
                const isDowngraded = invoiceCount > 3;
                const errorMessage = isDowngraded
                    ? `Your subscription has ended and you have ${invoiceCount} existing invoices. Your data is safe — re-subscribe to Pro to create new invoices.`
                    : 'Free plan limit reached (3 active invoices). Please upgrade to Pro for unlimited invoices.';

                return res.status(403).json({
                    success: false,
                    error: errorMessage,
                    code: isDowngraded ? 'DOWNGRADED_LIMIT' : 'LIMIT_REACHED',
                    isDowngraded,
                    currentCount: invoiceCount,
                    limit: 3
                });
            }
        }

        const allowedChannels = normalizeReminderChannels(reminderChannels, user.plan);

        const invoice = await InvoiceReminder.create({
            userId: req.user._id,
            clientName,
            clientEmail,
            clientPhone: clientPhone || null,
            amount,
            dueDate,
            paymentLink,
            invoiceNumber,
            reminderChannels: allowedChannels
        });

        // Generate portal token after creation (needs _id)
        invoice.portalToken = generatePortalToken(invoice._id);
        await invoice.save();

        dispatchWebhook(req.user.organization, 'invoice.created', invoice.toObject()).catch(() => {});

        // Auto-save or update client contact
        try {
            const clientData = {
                organization: req.user.organization,
                userId: req.user._id,
                name: clientName,
                email: clientEmail.toLowerCase(),
                phone: clientPhone || undefined,
            };
            const existingClient = await Client.findOneAndUpdate(
                { organization: req.user.organization, email: clientEmail.toLowerCase() },
                {
                    $set: { name: clientName, phone: clientPhone || undefined },
                    $setOnInsert: { organization: req.user.organization, userId: req.user._id, email: clientEmail.toLowerCase() },
                    $inc: { totalInvoices: 1, totalOutstanding: amount },
                    $max: { lastInvoiceDate: new Date() },
                },
                { upsert: true, new: true }
            );
            invoice.clientId = existingClient._id;
            await invoice.save();
        } catch {
            // Non-critical — don't fail the invoice creation
        }

        res.status(201).json({
            success: true,
            data: invoice,
            portalUrl: `${process.env.FRONTEND_URL}/pay/${invoice.portalToken}`
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

/**
 * @desc    Get all invoices for a user
 * @route   GET /api/invoice-reminder/invoices
 * @access  Private
 */
exports.getInvoices = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        const filter = { userId: req.user._id };

        if (req.query.status && ['draft', 'sent', 'paid', 'overdue'].includes(req.query.status)) {
            filter.status = req.query.status;
        }

        const [invoices, total] = await Promise.all([
            InvoiceReminder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
            InvoiceReminder.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            count: invoices.length,
            data: invoices,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

/**
 * @desc    Get dashboard stats
 * @route   GET /api/invoice-reminder/stats
 * @access  Private
 */
exports.getDashboardStats = async (req, res) => {
    try {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        // Six months ago for monthly chart
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        sixMonthsAgo.setHours(0, 0, 0, 0);

        const [statsResult, monthlyResult, avgDaysResult] = await Promise.all([
            InvoiceReminder.aggregate([
                { $match: { userId: req.user._id } },
                {
                    $group: {
                        _id: null,
                        totalUnpaid: { $sum: { $cond: [{ $ne: ['$status', 'paid'] }, 1, 0] } },
                        overdueAmount: { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, '$amount', 0] } },
                        paidThisMonth: {
                            $sum: {
                                $cond: [
                                    { $and: [{ $eq: ['$status', 'paid'] }, { $gte: ['$updatedAt', startOfMonth] }] },
                                    1,
                                    0
                                ]
                            }
                        },
                        paidThisMonthAmount: {
                            $sum: {
                                $cond: [
                                    { $and: [{ $eq: ['$status', 'paid'] }, { $gte: ['$updatedAt', startOfMonth] }] },
                                    '$amount',
                                    0
                                ]
                            }
                        },
                        totalInvoices: { $sum: 1 },
                        totalPaid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
                        totalAmount: { $sum: '$amount' },
                        totalPaidAmount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } }
                    }
                }
            ]),
            // Monthly paid amounts for last 6 months
            InvoiceReminder.aggregate([
                {
                    $match: {
                        userId: req.user._id,
                        status: 'paid',
                        updatedAt: { $gte: sixMonthsAgo }
                    }
                },
                {
                    $group: {
                        _id: { year: { $year: '$updatedAt' }, month: { $month: '$updatedAt' } },
                        amount: { $sum: '$amount' },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]),
            // Average days to payment (for paid invoices)
            InvoiceReminder.aggregate([
                {
                    $match: {
                        userId: req.user._id,
                        status: 'paid'
                    }
                },
                {
                    $project: {
                        daysToPayment: {
                            $divide: [
                                { $subtract: ['$updatedAt', '$createdAt'] },
                                1000 * 60 * 60 * 24
                            ]
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        avgDays: { $avg: '$daysToPayment' }
                    }
                }
            ])
        ]);

        const stats = statsResult[0];
        const avgDays = avgDaysResult[0]?.avgDays;

        // Build monthly chart data for last 6 months
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthlyChart = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            const found = monthlyResult.find(m => m._id.year === year && m._id.month === month);
            monthlyChart.push({
                label: `${monthNames[month - 1]} ${year}`,
                amount: found?.amount || 0,
                count: found?.count || 0
            });
        }

        res.status(200).json({
            success: true,
            data: {
                totalUnpaid: stats?.totalUnpaid || 0,
                overdueAmount: stats?.overdueAmount || 0,
                paidThisMonth: stats?.paidThisMonth || 0,
                paidThisMonthAmount: stats?.paidThisMonthAmount || 0,
                totalInvoices: stats?.totalInvoices || 0,
                totalPaidAmount: stats?.totalPaidAmount || 0,
                paymentRate: stats?.totalInvoices > 0
                    ? Math.round((stats.totalPaid / stats.totalInvoices) * 100)
                    : 0,
                avgDaysToPayment: avgDays != null ? Math.round(avgDays) : null,
                monthlyChart
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

/**
 * @desc    Mark invoice as paid
 * @route   PUT /api/invoice-reminder/invoices/:id/pay
 * @access  Private
 */
exports.markAsPaid = async (req, res) => {
    try {
        const invoice = await InvoiceReminder.findById(req.params.id);

        if (!invoice) {
            return res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
        }

        // Verify user owns invoice
        if (invoice.userId.toString() !== req.user._id.toString()) {
            return res.status(401).json({
                success: false,
                error: 'Not authorized'
            });
        }

        invoice.status = 'paid';
        await invoice.save();

        dispatchWebhook(req.user.organization, 'invoice.paid', invoice.toObject()).catch(() => {});

        res.status(200).json({
            success: true,
            data: invoice
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

/**
 * @desc    Update invoice
 * @route   PUT /api/invoice-reminder/invoices/:id
 * @access  Private
 */
exports.updateInvoice = async (req, res) => {
    try {
        let invoice = await InvoiceReminder.findById(req.params.id);

        if (!invoice) {
            return res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
        }

        // Verify user owns invoice
        if (invoice.userId.toString() !== req.user._id.toString()) {
            return res.status(401).json({
                success: false,
                error: 'Not authorized'
            });
        }

        let body = { ...req.body };
        if (body.reminderChannels) {
            body.reminderChannels = normalizeReminderChannels(body.reminderChannels);
        }

        invoice = await InvoiceReminder.findByIdAndUpdate(req.params.id, body, {
            new: true,
            runValidators: true
        });

        dispatchWebhook(req.user.organization, 'invoice.updated', invoice.toObject()).catch(() => {});

        res.status(200).json({
            success: true,
            data: invoice
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

/**
 * @desc    Delete invoice
 * @route   DELETE /api/invoice-reminder/invoices/:id
 * @access  Private
 */
exports.deleteInvoice = async (req, res) => {
    try {
        const invoice = await InvoiceReminder.findById(req.params.id);

        if (!invoice) {
            return res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
        }

        // Verify user owns invoice
        if (invoice.userId.toString() !== req.user._id.toString()) {
            return res.status(401).json({
                success: false,
                error: 'Not authorized'
            });
        }

        const invoiceData = invoice.toObject();
        await invoice.deleteOne();

        dispatchWebhook(req.user.organization, 'invoice.deleted', invoiceData).catch(() => {});

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

/**
 * @desc    Send manual reminder via all configured channels
 * @route   POST /api/invoice-reminder/invoices/:id/remind
 * @access  Private
 */
exports.sendManualReminder = async (req, res) => {
    try {
        const invoice = await InvoiceReminder.findById(req.params.id).populate('userId', 'name companyName');

        if (!invoice) {
            return res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
        }

        // Verify user owns invoice
        if (invoice.userId._id.toString() !== req.user._id.toString()) {
            return res.status(401).json({
                success: false,
                error: 'Not authorized'
            });
        }

        // Cooldown: prevent sending more than once per hour
        const COOLDOWN_MS = 60 * 60 * 1000;
        if (invoice.remindersSent && invoice.remindersSent.length > 0) {
            const lastSent = new Date(invoice.remindersSent[invoice.remindersSent.length - 1]);
            const elapsed = Date.now() - lastSent.getTime();
            if (elapsed < COOLDOWN_MS) {
                const waitMinutes = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
                return res.status(429).json({
                    success: false,
                    error: `Please wait ${waitMinutes} minute${waitMinutes > 1 ? 's' : ''} before sending another reminder.`,
                    retryAfterMinutes: waitMinutes
                });
            }
        }

        const senderName = invoice.userId.companyName || invoice.userId.name;
        const invoiceRef = invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : '';
        const invoiceDisplay = invoiceRef ? ` ${invoiceRef}` : '';
        const paymentLink = invoice.paymentLink;
        const portalUrl = invoice.portalToken
            ? `${process.env.FRONTEND_URL}/pay/${invoice.portalToken}`
            : null;
        const actionLink = portalUrl || paymentLink;
        const channels = normalizeReminderChannels(invoice.reminderChannels, req.user.plan);
        const results = [];

        console.log('📤 Sending manual reminder:');
        console.log('  Invoice ID:', invoice._id);
        console.log('  Channels:', channels);
        console.log('  Client Email:', invoice.clientEmail);

        // --- Send via Email ---
        if (channels.includes('email')) {
            const sendEmail = require('../utils/sendEmail');

            const subject = `Reminder: Invoice${invoiceDisplay} from ${senderName}`;
            let message = `Hi ${invoice.clientName},\n\n`;
            message += `Just a friendly reminder about invoice${invoiceDisplay}\n`;
            message += `from ${senderName} for $${invoice.amount.toLocaleString()}, due ${new Date(invoice.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`;
            if (actionLink) {
                message += `\n\nView or pay this invoice:\n👉 ${actionLink}`;
            } else {
                message += `\n\nPlease contact ${senderName} for payment details.`;
            }
            message += `\n\nThanks,\n${senderName}`;

            let htmlMessage = `<p>Hi ${invoice.clientName},</p>
<p>Just a friendly reminder about invoice${invoiceRef ? ` <strong>${invoiceRef}</strong>` : ''}<br>
from ${senderName} for <strong>$${invoice.amount.toLocaleString()}</strong>, due ${new Date(invoice.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.</p>`;
            if (actionLink) {
                htmlMessage += `<p style="margin: 20px 0;"><a href="${actionLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View & Pay Invoice</a></p>`;
            } else {
                htmlMessage += `<p>Please contact ${senderName} for payment details.</p>`;
            }
            htmlMessage += `<p>Thanks,<br>\n${senderName}</p>`;

            const emailOptions = { to: invoice.clientEmail, subject, text: message, html: htmlMessage };

            try {
                const { generateInvoicePdf } = require('../utils/invoicePdfGenerator');
                const removeBranding = req.user.plan === 'pro';
                const pdfBuffer = await generateInvoicePdf(invoice, req.user, { removeBranding });
                const pdfFilename = invoice.invoiceNumber ? `invoice-${invoice.invoiceNumber}.pdf` : 'invoice.pdf';
                emailOptions.attachments = [{ filename: pdfFilename, content: pdfBuffer }];
            } catch (pdfErr) {
                console.warn('PDF generation failed, sending email without attachment:', pdfErr.message);
            }

            await sendEmail(emailOptions);
            await InvoiceReminderLog.create({ invoiceId: invoice._id, type: 'manual_reminder', channel: 'email' });
            results.push('email');
        }

        // --- Send via WhatsApp ---
        if (channels.includes('whatsapp') && invoice.clientPhone) {
            const whatsappService = require('../services/whatsappService');
            if (whatsappService.isConfigured()) {
                try {
                    const waResult = await whatsappService.sendInvoiceReminder({
                        to: invoice.clientPhone,
                        clientName: invoice.clientName,
                        invoiceNumber: invoice.invoiceNumber,
                        amount: invoice.amount,
                        dueDate: new Date(invoice.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                        paymentLink: actionLink,
                        reminderType: 'manual'
                    });
                    if (waResult.success) {
                        await InvoiceReminderLog.create({ invoiceId: invoice._id, type: 'manual_reminder', channel: 'whatsapp' });
                        results.push('whatsapp');
                    } else {
                        console.error('[Reminder] WhatsApp send failed for invoice:', invoice._id, waResult.error);
                    }
                } catch (waErr) {
                    console.error('[Reminder] WhatsApp send error for invoice:', invoice._id, waErr.message);
                }
            } else {
                console.warn('[Reminder] WhatsApp channel requested but not configured for invoice:', invoice._id);
            }
        }

        // Update invoice remindersSent
        if (!invoice.remindersSent) invoice.remindersSent = [];
        invoice.remindersSent.push(new Date());
        await invoice.save();

        dispatchWebhook(req.user.organization, 'reminder.sent', {
            invoice: invoice.toObject(),
            channels: results,
            type: 'manual'
        }).catch(() => {});

        res.status(200).json({
            success: true,
            message: `Reminder sent via: ${results.join(', ')}`,
            channels: results
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};


/**
 * @desc    Check for due invoices and send reminders (Cron Job Logic)
 * @access  Internal/Private
 */
exports.checkAndSendReminders = async () => {
    console.log('[InvoiceReminder] Checking for reminders...');
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find all active invoices (not paid)
        const invoices = await InvoiceReminder.find({
            status: { $ne: 'paid' }
        }).populate('userId');

        // Cache custom schedules per org to avoid repeated DB lookups
        const settingsCache = {};

        for (const invoice of invoices) {
            if (!invoice.userId) continue;

            const dueDate = new Date(invoice.dueDate);
            dueDate.setHours(0, 0, 0, 0);

            const diffTime = today.getTime() - dueDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let reminderType = null;

            // Load custom schedule for Pro users
            const orgId = invoice.userId.organization?.toString();
            const userPlan = invoice.userId.plan || 'free';
            let customSchedule = null;

            if (userPlan === 'pro' && orgId) {
                if (!(orgId in settingsCache)) {
                    const settings = await InvoiceSettings.findOne({ organization: orgId });
                    settingsCache[orgId] = (settings?.autoReminders?.enabled && settings.autoReminders)
                        ? settings.autoReminders : null;
                }
                customSchedule = settingsCache[orgId];
            }

            if (customSchedule) {
                const beforeDays = customSchedule.beforeDueDays || [];
                const afterDays = customSchedule.afterDueDays || [];

                if (diffDays < 0 && beforeDays.some(d => Math.abs(diffDays) <= d && Math.abs(diffDays) >= d - 2)) {
                    reminderType = 'before_due';
                } else if (diffDays === 0) {
                    reminderType = 'on_due';
                } else if (diffDays > 0 && afterDays.some(d => diffDays >= d - 1 && diffDays <= d + 1)) {
                    reminderType = 'after_due';
                }
            } else {
                // Default hardcoded schedule for free users
                if (diffDays >= -3 && diffDays < 0) reminderType = 'before_due';
                else if (diffDays === 0) reminderType = 'on_due';
                else if (diffDays >= 1 && diffDays <= 5) reminderType = 'after_due_3';
                else if (diffDays >= 6 && diffDays <= 10) reminderType = 'after_due_7';
            }

            if (reminderType) {
                // Check if this reminder type was already sent for this invoice
                const logType = reminderType.startsWith('after_due') ? 'after_due' : reminderType;
                const alreadySent = await InvoiceReminderLog.findOne({
                    invoiceId: invoice._id,
                    type: logType
                });

                if (!alreadySent) {
                    const sendEmail = require('../utils/sendEmail');
                    const senderName = invoice.userId.companyName || invoice.userId.name;
                    const invoiceRef = invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : '';
                    const invoiceDisplay = invoiceRef ? ` ${invoiceRef}` : '';
                    const invoiceRefHtml = invoiceRef ? ` <strong>${invoiceRef}</strong>` : '';
                    const paymentLink = invoice.paymentLink;
                    const portalUrl = invoice.portalToken
                        ? `${process.env.FRONTEND_URL}/pay/${invoice.portalToken}`
                        : null;
                    const actionLink = portalUrl || paymentLink;
                    const userPlan = invoice.userId.plan || 'free';
                    const channels = normalizeReminderChannels(invoice.reminderChannels, userPlan);

                    let subject = `Reminder: Invoice${invoiceDisplay} from ${senderName}`;
                    let plainMessage = `Hi ${invoice.clientName},\n\n`;
                    let htmlBody = ``;

                    if (reminderType === 'before_due') {
                        subject = `Upcoming Invoice${invoiceDisplay} from ${senderName}`;
                        plainMessage += `Just a friendly reminder that invoice${invoiceDisplay} from ${senderName} for $${invoice.amount.toLocaleString()} is due on ${invoice.dueDate.toDateString()}.`;
                        htmlBody = `Just a friendly reminder that invoice${invoiceRefHtml} from ${senderName}<br>for <strong>$${invoice.amount.toLocaleString()}</strong> is due on ${invoice.dueDate.toDateString()}.`;
                    } else if (reminderType === 'on_due') {
                        subject = `Invoice${invoiceDisplay} Due Today`;
                        plainMessage += `Your invoice${invoiceDisplay} from ${senderName} for $${invoice.amount.toLocaleString()} is due today.`;
                        htmlBody = `Your invoice${invoiceRefHtml} from ${senderName}<br>for <strong>$${invoice.amount.toLocaleString()}</strong> is due today.`;
                    } else {
                        subject = `Overdue: Invoice${invoiceDisplay} from ${senderName}`;
                        plainMessage += `Your invoice${invoiceDisplay} from ${senderName} for $${invoice.amount.toLocaleString()} was due on ${invoice.dueDate.toDateString()}. Please pay as soon as possible.`;
                        htmlBody = `Your invoice${invoiceRefHtml} from ${senderName}<br>for <strong>$${invoice.amount.toLocaleString()}</strong> was due on ${invoice.dueDate.toDateString()}.<br><span style="color: red;">Please pay as soon as possible.</span>`;

                        if (invoice.status !== 'overdue') {
                            invoice.status = 'overdue';
                            await invoice.save();
                        }
                    }

                    if (actionLink) {
                        plainMessage += `\n\nView or pay this invoice:\n👉 ${actionLink}`;
                        htmlBody += `<p style="margin: 20px 0;"><a href="${actionLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View & Pay Invoice</a></p>`;
                    } else {
                        plainMessage += `\n\nPlease contact ${senderName} for payment details.`;
                        htmlBody += `<p>Please contact ${senderName} for payment details.</p>`;
                    }
                    plainMessage += `\n\nThanks,\n${senderName}`;
                    const htmlMessage = `<p>Hi ${invoice.clientName},</p>\n<p>${htmlBody}</p>\n<p>Thanks,<br>\n${senderName}</p>`;

                    // --- Send via Email ---
                    if (channels.includes('email')) {
                        console.log(`[InvoiceReminder] Sending ${reminderType} email to ${invoice.clientEmail}`);
                        const emailOptions = { to: invoice.clientEmail, subject, text: plainMessage, html: htmlMessage };

                        try {
                            const { generateInvoicePdf } = require('../utils/invoicePdfGenerator');
                            const removeBranding = userPlan === 'pro';
                            const pdfBuffer = await generateInvoicePdf(invoice, invoice.userId, { removeBranding });
                            const pdfFilename = invoice.invoiceNumber ? `invoice-${invoice.invoiceNumber}.pdf` : 'invoice.pdf';
                            emailOptions.attachments = [{ filename: pdfFilename, content: pdfBuffer }];
                        } catch (pdfErr) {
                            console.warn('PDF generation failed, sending email without attachment:', pdfErr.message);
                        }

                        await sendEmail(emailOptions);
                        await InvoiceReminderLog.create({ invoiceId: invoice._id, type: logType, channel: 'email' });
                    }

                    // --- Send via WhatsApp ---
                    if (channels.includes('whatsapp') && invoice.clientPhone) {
                        const whatsappService = require('../services/whatsappService');
                        if (whatsappService.isConfigured()) {
                            try {
                                const waResult = await whatsappService.sendInvoiceReminder({
                                    to: invoice.clientPhone,
                                    clientName: invoice.clientName,
                                    invoiceNumber: invoice.invoiceNumber,
                                    amount: invoice.amount,
                                    dueDate: invoice.dueDate.toDateString(),
                                    paymentLink: actionLink,
                                    reminderType
                                });
                                if (waResult.success) {
                                    await InvoiceReminderLog.create({ invoiceId: invoice._id, type: logType, channel: 'whatsapp' });
                                } else {
                                    console.error('[Scheduler] WhatsApp send failed for invoice:', invoice._id, waResult.error);
                                }
                            } catch (waErr) {
                                console.error('[Scheduler] WhatsApp send error for invoice:', invoice._id, waErr.message);
                            }
                        }
                    }

                    // Update invoice remindersSent
                    if (!invoice.remindersSent) invoice.remindersSent = [];
                    invoice.remindersSent.push(new Date());
                    await invoice.save();
                }
            }
        }
    } catch (err) {
        console.error('[InvoiceReminder] Error checking reminders:', err);
    }
};

/**
 * @desc    Get single invoice
 * @route   GET /api/invoice-reminder/invoices/:id
 * @access  Private
 */
exports.getInvoice = async (req, res) => {
    try {
        const invoice = await InvoiceReminder.findById(req.params.id);

        if (!invoice) {
            return res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
        }

        // Verify user owns invoice
        if (invoice.userId.toString() !== req.user._id.toString()) {
            return res.status(401).json({
                success: false,
                error: 'Not authorized'
            });
        }

        res.status(200).json({
            success: true,
            data: invoice
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

/**
 * @desc    Get invoice logs (reminder history)
 * @route   GET /api/invoice-reminder/invoices/:id/logs
 * @access  Private
 */
exports.getInvoiceLogs = async (req, res) => {
    try {
        const invoice = await InvoiceReminder.findById(req.params.id);

        if (!invoice) {
            return res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
        }

        // Verify user owns invoice
        if (invoice.userId.toString() !== req.user._id.toString()) {
            return res.status(401).json({
                success: false,
                error: 'Not authorized'
            });
        }

        const logs = await InvoiceReminderLog.find({ invoiceId: req.params.id })
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: logs.length,
            data: logs
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

/**
 * @desc    Download invoice PDF
 * @route   GET /api/invoice-reminder/invoices/:id/pdf
 * @access  Private
 */
exports.downloadInvoicePdf = async (req, res) => {
    try {
        const invoice = await InvoiceReminder.findById(req.params.id);

        if (!invoice) {
            return res.status(404).json({ success: false, error: 'Invoice not found' });
        }

        if (invoice.userId.toString() !== req.user._id.toString()) {
            return res.status(401).json({ success: false, error: 'Not authorized' });
        }

        const { generateInvoicePdf } = require('../utils/invoicePdfGenerator');
        const removeBranding = req.user.plan === 'pro';

        const pdfBuffer = await generateInvoicePdf(invoice, req.user, { removeBranding });

        const filename = invoice.invoiceNumber
            ? `invoice-${invoice.invoiceNumber}.pdf`
            : `invoice-${invoice._id}.pdf`;

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': pdfBuffer.length
        });

        res.send(pdfBuffer);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

/**
 * @desc    Get reminder schedule settings
 * @route   GET /api/invoice-reminder/settings/schedule
 * @access  Private (Pro)
 */
exports.getReminderSchedule = async (req, res) => {
    try {
        const orgId = req.user.organization;
        if (!orgId) {
            return res.json({
                success: true,
                data: { enabled: false, beforeDueDays: [3], afterDueDays: [3, 7] }
            });
        }

        let settings = await InvoiceSettings.findOne({ organization: orgId });
        const schedule = settings?.autoReminders || { enabled: false, beforeDueDays: [3], afterDueDays: [3, 7] };

        res.json({ success: true, data: schedule });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

/**
 * @desc    Update reminder schedule settings
 * @route   PUT /api/invoice-reminder/settings/schedule
 * @access  Private (Pro)
 */
exports.updateReminderSchedule = async (req, res) => {
    try {
        if (req.user.plan !== 'pro') {
            return res.status(403).json({ success: false, error: 'Pro plan required' });
        }

        const orgId = req.user.organization;
        if (!orgId) {
            return res.status(400).json({ success: false, error: 'No organization found' });
        }

        const { enabled, beforeDueDays, afterDueDays } = req.body;

        const validBefore = (beforeDueDays || []).filter(d => Number.isInteger(d) && d >= 1 && d <= 30);
        const validAfter = (afterDueDays || []).filter(d => Number.isInteger(d) && d >= 1 && d <= 60);

        let settings = await InvoiceSettings.findOne({ organization: orgId });
        if (!settings) {
            settings = new InvoiceSettings({ organization: orgId });
        }

        settings.autoReminders = {
            enabled: !!enabled,
            beforeDueDays: validBefore,
            afterDueDays: validAfter
        };
        settings.updatedBy = req.user._id;
        await settings.save();

        res.json({ success: true, data: settings.autoReminders });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

