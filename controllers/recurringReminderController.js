const RecurringReminder = require('../models/RecurringReminder');
const InvoiceReminder = require('../models/InvoiceReminder');
const { generatePortalToken } = require('../utils/portalToken');

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
        }).populate('userId', 'name companyName plan');

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

                invoice.portalToken = generatePortalToken(invoice._id);
                await invoice.save();

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
