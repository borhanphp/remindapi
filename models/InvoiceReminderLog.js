const mongoose = require('mongoose');

const invoiceReminderLogSchema = new mongoose.Schema({
    invoiceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InvoiceReminder',
        required: true
    },
    // e.g. 'before_due', 'before_due_7', 'on_due', 'after_due_3', 'manual_reminder'.
    // Kept free-form so each schedule window dedupes independently.
    type: {
        type: String,
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

invoiceReminderLogSchema.index({ invoiceId: 1, type: 1 });

module.exports = mongoose.model('InvoiceReminderLog', invoiceReminderLogSchema);
