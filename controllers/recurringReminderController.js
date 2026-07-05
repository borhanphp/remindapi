const RecurringReminder = require('../models/RecurringReminder');
const InvoiceReminder = require('../models/InvoiceReminder');
const InvoiceReminderLog = require('../models/InvoiceReminderLog');
const Client = require('../models/Client');
const { generatePortalToken } = require('../utils/portalToken');
const { escapeHtml, formatCurrency, formatDateInTz, reminderEmailFooter } = require('../utils/format');

exports.create = async (req, res) => {
    try {
        const { clientName, clientEmail, clientPhone, amount, invoicePrefix, paymentLink,
            frequency, startDate, endDate, autoSend, reminderChannels } = req.body;

        const recurring = await RecurringReminder.create({
            userId: req.user._id,
            clientName,
            clientEmail,
            clientPhone,
            amount,
            invoicePrefix: invoicePrefix || 'REC',
            paymentLink,
            frequency,
            startDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : undefined,
            nextGenerationDate: new Date(startDate),
            autoSend: autoSend !== false,
            reminderChannels: reminderChannels || ['email']
        });

        res.status(201).json({ success: true, data: recurring });
    } catch (err) {
        console.error(err);
        res.status(400).json({ success: false, error: err.message });
    }
};

exports.getAll = async (req, res) => {
    try {
        const items = await RecurringReminder.find({ userId: req.user._id })
            .sort({ createdAt: -1 });

        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

exports.getOne = async (req, res) => {
    try {
        const item = await RecurringReminder.findById(req.params.id);
        if (!item || item.userId.toString() !== req.user._id.toString()) {
            return res.status(404).json({ success: false, error: 'Not found' });
        }
        res.json({ success: true, data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

exports.update = async (req, res) => {
    try {
        const item = await RecurringReminder.findById(req.params.id);
        if (!item || item.userId.toString() !== req.user._id.toString()) {
            return res.status(404).json({ success: false, error: 'Not found' });
        }

        const allowed = ['clientName', 'clientEmail', 'clientPhone', 'amount', 'invoicePrefix',
            'paymentLink', 'frequency', 'endDate', 'autoSend', 'reminderChannels', 'status'];
        for (const key of allowed) {
            if (req.body[key] !== undefined) item[key] = req.body[key];
        }
        await item.save();

        res.json({ success: true, data: item });
    } catch (err) {
        console.error(err);
        res.status(400).json({ success: false, error: err.message });
    }
};

exports.remove = async (req, res) => {
    try {
        const item = await RecurringReminder.findById(req.params.id);
        if (!item || item.userId.toString() !== req.user._id.toString()) {
            return res.status(404).json({ success: false, error: 'Not found' });
        }
        await item.deleteOne();
        res.json({ success: true, data: {} });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

exports.processRecurringReminders = async () => {
    try {
        const due = await RecurringReminder.find({
            status: 'active',
            nextGenerationDate: { $lte: new Date() }
        }).populate('userId', 'name companyName plan organization timezone');

        console.log(`[RecurringReminder] Found ${due.length} due recurring reminders`);

        for (const rec of due) {
            try {
                const counter = rec.totalGenerated + 1;
                const invoiceNumber = `${rec.invoicePrefix}-${String(counter).padStart(4, '0')}`;

                const dueDate = new Date();
                switch (rec.frequency) {
                    case 'weekly': dueDate.setDate(dueDate.getDate() + 7); break;
                    case 'biweekly': dueDate.setDate(dueDate.getDate() + 14); break;
                    case 'monthly': dueDate.setMonth(dueDate.getMonth() + 1); break;
                    case 'quarterly': dueDate.setMonth(dueDate.getMonth() + 3); break;
                    case 'annually': dueDate.setFullYear(dueDate.getFullYear() + 1); break;
                }

                const invoice = await InvoiceReminder.create({
                    userId: rec.userId._id,
                    clientName: rec.clientName,
                    clientEmail: rec.clientEmail,
                    clientPhone: rec.clientPhone,
                    invoiceNumber,
                    amount: rec.amount,
                    dueDate,
                    paymentLink: rec.paymentLink,
                    reminderChannels: rec.reminderChannels,
                    status: 'sent',
                    recurringReminderId: rec._id
                });

                invoice.portalToken = generatePortalToken();
                await invoice.save();

                // Auto-send: deliver the new invoice to the client immediately
                if (rec.autoSend && rec.userId) {
                    try {
                        await sendInvoiceIssuedNotification(invoice, rec.userId);
                    } catch (notifyErr) {
                        console.error(`[RecurringReminder] Issue notification failed for ${invoiceNumber}:`, notifyErr.message);
                    }
                }

                rec.lastGenerationDate = new Date();
                rec.nextGenerationDate = rec.calculateNextDate();
                rec.totalGenerated += 1;
                rec.generationHistory.push({
                    generatedAt: new Date(),
                    invoiceId: invoice._id,
                    invoiceNumber
                });

                if (rec.endDate && rec.nextGenerationDate > rec.endDate) {
                    rec.status = 'completed';
                }

                await rec.save();
                console.log(`[RecurringReminder] Created invoice ${invoiceNumber}`);
            } catch (err) {
                console.error(`[RecurringReminder] Error processing ${rec._id}:`, err.message);
            }
        }
    } catch (err) {
        console.error('[RecurringReminder] Critical error:', err);
    }
};

/**
 * Send the freshly generated invoice to the client (email + optional WhatsApp).
 * Used when the recurring template has autoSend enabled.
 */
async function sendInvoiceIssuedNotification(invoice, owner) {
    const senderName = owner.companyName || owner.name;
    const plan = owner.plan || 'free';
    const portalUrl = `${process.env.FRONTEND_URL}/pay/${invoice.portalToken}`;
    const actionLink = portalUrl || invoice.paymentLink;
    const amountDisplay = formatCurrency(invoice.amount, invoice.currency);
    const dueDisplay = formatDateInTz(invoice.dueDate, owner.timezone);
    const invoiceRef = invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : '';
    const invoiceDisplay = invoiceRef ? ` ${invoiceRef}` : '';
    const channels = Array.isArray(invoice.reminderChannels) && invoice.reminderChannels.length > 0
        ? invoice.reminderChannels
        : ['email'];

    // --- Email ---
    if (channels.includes('email')) {
        const optedOut = await Client.findOne({
            organization: owner.organization,
            email: invoice.clientEmail.toLowerCase(),
            emailOptOut: true
        }).select('_id');

        if (optedOut) {
            console.log(`[RecurringReminder] Skipped issue email to ${invoice.clientEmail} (unsubscribed)`);
        } else {
            const sendEmail = require('../utils/sendEmail');
            const footer = reminderEmailFooter(invoice.portalToken);

            const subject = `New Invoice${invoiceDisplay} from ${senderName}`;
            let text = `Hi ${invoice.clientName},\n\n`;
            text += `${senderName} has sent you a new invoice${invoiceDisplay} for ${amountDisplay}, due ${dueDisplay}.`;
            text += `\n\nView or pay this invoice:\n👉 ${actionLink}`;
            text += `\n\nThanks,\n${senderName}${footer.text}`;

            let html = `<p>Hi ${escapeHtml(invoice.clientName)},</p>
<p>${escapeHtml(senderName)} has sent you a new invoice${invoiceRef ? ` <strong>${escapeHtml(invoiceRef)}</strong>` : ''}<br>
for <strong>${escapeHtml(amountDisplay)}</strong>, due ${dueDisplay}.</p>
<p style="margin: 20px 0;"><a href="${actionLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View & Pay Invoice</a></p>
<p>Thanks,<br>\n${escapeHtml(senderName)}</p>${footer.html}`;

            const emailOptions = { to: invoice.clientEmail, subject, text, html };

            try {
                const { generateInvoicePdf } = require('../utils/invoicePdfGenerator');
                const pdfBuffer = await generateInvoicePdf(invoice, owner, { removeBranding: plan === 'pro' });
                const pdfFilename = invoice.invoiceNumber ? `invoice-${invoice.invoiceNumber}.pdf` : 'invoice.pdf';
                emailOptions.attachments = [{ filename: pdfFilename, content: pdfBuffer }];
            } catch (pdfErr) {
                console.warn('[RecurringReminder] PDF generation failed, sending without attachment:', pdfErr.message);
            }

            await sendEmail(emailOptions);
            await InvoiceReminderLog.create({ invoiceId: invoice._id, type: 'issued', channel: 'email' });
            console.log(`[RecurringReminder] Issue email sent to ${invoice.clientEmail} for ${invoiceRef || invoice._id}`);
        }
    }

    // --- WhatsApp (Pro only) ---
    if (channels.includes('whatsapp') && plan === 'pro' && invoice.clientPhone) {
        const whatsappService = require('../services/whatsappService');
        if (whatsappService.isConfigured()) {
            const body = `Hi ${invoice.clientName}, ${senderName} has sent you a new invoice${invoiceDisplay} for ${amountDisplay}, due ${dueDisplay}.\n\nView or pay here: ${actionLink}`;
            const waResult = await whatsappService.sendWhatsAppText({ to: invoice.clientPhone, body });
            if (waResult.success) {
                await InvoiceReminderLog.create({ invoiceId: invoice._id, type: 'issued', channel: 'whatsapp' });
            } else {
                console.error('[RecurringReminder] WhatsApp issue notification failed:', waResult.error);
            }
        }
    }
}
