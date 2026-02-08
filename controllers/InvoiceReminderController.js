const InvoiceReminder = require('../models/InvoiceReminder');
const InvoiceReminderLog = require('../models/InvoiceReminderLog');

/**
 * @desc    Create a new invoice
 * @route   POST /api/invoice-reminder/invoices
 * @access  Private
 */
exports.createInvoice = async (req, res) => {
    try {
        const { clientName, clientEmail, amount, dueDate, paymentLink, invoiceNumber } = req.body;

        // Feature Gating: Check Plan Limits
        const user = req.user; // Assumes auth middleware populates this
        if (user.plan === 'free') {
            // Lifetime Limit check (no date filter)
            const invoiceCount = await InvoiceReminder.countDocuments({
                userId: user._id
            });

            if (invoiceCount >= 5) {
                return res.status(403).json({
                    success: false,
                    error: 'Free plan limit reached (5 invoices). Please upgrade to Pro for unlimited invoices.',
                    code: 'LIMIT_REACHED'
                });
            }
        }

        const invoice = await InvoiceReminder.create({
            userId: req.user._id, // Assuming auth middleware adds user to req
            clientName,
            clientEmail,
            amount,
            dueDate,
            paymentLink,
            invoiceNumber
        });

        res.status(201).json({
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
 * @desc    Get all invoices for a user
 * @route   GET /api/invoice-reminder/invoices
 * @access  Private
 */
exports.getInvoices = async (req, res) => {
    try {
        const invoices = await InvoiceReminder.find({ userId: req.user._id })
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: invoices.length,
            data: invoices
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
        const invoices = await InvoiceReminder.find({ userId: req.user._id });

        const totalUnpaid = invoices.filter(inv => inv.status !== 'paid').length;

        const overdueAmount = invoices
            .filter(inv => inv.status === 'overdue')
            .reduce((acc, curr) => acc + curr.amount, 0);

        const paidThisMonth = invoices
            .filter(inv => {
                const isPaid = inv.status === 'paid';
                const isThisMonth = new Date(inv.updatedAt) > new Date(new Date().setDate(1)); // Rough check
                return isPaid && isThisMonth;
            })
            .length;

        res.status(200).json({
            success: true,
            data: {
                totalUnpaid,
                overdueAmount,
                paidThisMonth
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

        invoice = await InvoiceReminder.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

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

        await invoice.deleteOne();

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
 * @desc    Send manual reminder
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

        // Send Email
        const { sendEmail } = require('../utils/notify');

        const senderName = invoice.userId.companyName || invoice.userId.name;
        // Use invoiceNumber if available, otherwise send nothing (no fallback ID)
        const invoiceRef = invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : '';
        const invoiceDisplay = invoiceRef ? ` ${invoiceRef}` : '';

        // ONLY use custom link.
        const paymentLink = invoice.paymentLink;

        const subject = `Reminder: Invoice${invoiceDisplay} from ${senderName}`;

        // Plain text version
        let message = `Hi ${invoice.clientName},\n\n`;
        message += `Just a friendly reminder about invoice${invoiceDisplay}\n`;
        message += `from ${senderName} for $${invoice.amount.toLocaleString()}, due ${new Date(invoice.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`;

        if (paymentLink) {
            message += `\n\nYou can view or pay the invoice here:\n👉 ${paymentLink}`;
        } else {
            message += `\n\nPlease contact ${senderName} for payment details.`;
        }

        message += `\n\nThanks,\n${senderName}`;

        // HTML version
        let htmlMessage = `<p>Hi ${invoice.clientName},</p>
<p>Just a friendly reminder about invoice${invoiceRef ? ` <strong>${invoiceRef}</strong>` : ''}<br>
from ${senderName} for <strong>$${invoice.amount.toLocaleString()}</strong>, due ${new Date(invoice.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.</p>`;

        if (paymentLink) {
            htmlMessage += `<p>You can view or pay the invoice here:<br>
👉 <a href="${paymentLink}">${paymentLink}</a></p>`;
        } else {
            htmlMessage += `<p>Please contact ${senderName} for payment details.</p>`;
        }

        htmlMessage += `<p>Thanks,<br>
${senderName}</p>`;

        await sendEmail({
            to: invoice.clientEmail,
            subject: subject,
            text: message,
            html: htmlMessage
        });

        // Log it
        await InvoiceReminderLog.create({
            invoiceId: invoice._id,
            type: 'manual_reminder',
        });

        // Update invoice remindersSent
        if (!invoice.remindersSent) invoice.remindersSent = [];
        invoice.remindersSent.push(new Date());
        await invoice.save();

        res.status(200).json({
            success: true,
            message: 'Reminder sent successfully'
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

        for (const invoice of invoices) {
            if (!invoice.userId) continue;

            const dueDate = new Date(invoice.dueDate);
            dueDate.setHours(0, 0, 0, 0);

            const diffTime = today.getTime() - dueDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Positive = overdue, Negative = before due

            let reminderType = null;

            // Logic: 
            // -3 days (Before Due)
            // 0 days (On Due Date)
            // +3 days (Overdue)
            // +7 days (Overdue)

            if (diffDays === -3) reminderType = 'before_due';
            else if (diffDays === 0) reminderType = 'on_due';
            else if (diffDays === 3) reminderType = 'after_due_3';
            else if (diffDays === 7) reminderType = 'after_due_7';

            if (reminderType) {
                // Check if already sent today/for this type to avoid duplicates (basic check)
                const alreadySent = await InvoiceReminderLog.findOne({
                    invoiceId: invoice._id,
                    type: reminderType.startsWith('after_due') ? 'after_due' : reminderType,
                    createdAt: {
                        $gte: today,
                        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
                    }
                });

                if (!alreadySent) {
                    // Send Email
                    const { sendEmail } = require('../utils/notify'); // Lazy load

                    const senderName = invoice.userId.companyName || invoice.userId.name;
                    // Use invoiceNumber if available, otherwise send nothing
                    const invoiceRef = invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : '';
                    const invoiceDisplay = invoiceRef ? ` ${invoiceRef}` : '';
                    const invoiceRefHtml = invoiceRef ? ` <strong>${invoiceRef}</strong>` : '';

                    // ONLY use custom link.
                    const paymentLink = invoice.paymentLink;

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

                        // Update status to overdue if not already
                        if (invoice.status !== 'overdue') {
                            invoice.status = 'overdue';
                            await invoice.save();
                        }
                    }

                    // Append link and signature
                    if (paymentLink) {
                        plainMessage += `\n\nYou can view or pay the invoice here:\n👉 ${paymentLink}`;
                        htmlBody += `<p>You can view or pay the invoice here:<br>
👉 <a href="${paymentLink}">${paymentLink}</a></p>`;
                    } else {
                        plainMessage += `\n\nPlease contact ${senderName} for payment details.`;
                        htmlBody += `<p>Please contact ${senderName} for payment details.</p>`;
                    }

                    plainMessage += `\n\nThanks,\n${senderName}`;
                    const htmlMessage = `<p>Hi ${invoice.clientName},</p>
<p>${htmlBody}</p>
<p>Thanks,<br>
${senderName}</p>`;

                    console.log(`[InvoiceReminder] Sending ${reminderType} to ${invoice.clientEmail}`);

                    await sendEmail({
                        to: invoice.clientEmail,
                        subject: subject,
                        text: plainMessage,
                        html: htmlMessage
                    });

                    // Log it
                    await InvoiceReminderLog.create({
                        invoiceId: invoice._id,
                        type: reminderType.startsWith('after_due') ? 'after_due' : reminderType,
                    });

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

