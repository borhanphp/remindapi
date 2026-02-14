const mongoose = require('mongoose');

const invoiceReminderLogSchema = new mongoose.Schema({
    invoiceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InvoiceReminder',
        required: true
    },
    type: {
        type: String,
        enum: ['before_due', 'on_due', 'after_due', 'manual_reminder'],
        required: true
    },
    channel: {
        type: String,
        enum: ['email', 'sms', 'whatsapp'],
        default: 'email'
    },
    sentAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('InvoiceReminderLog', invoiceReminderLogSchema);
