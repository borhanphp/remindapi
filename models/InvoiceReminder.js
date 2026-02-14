const mongoose = require('mongoose');

const invoiceReminderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    clientName: {
        type: String,
        required: true
    },
    invoiceNumber: {
        type: String,
        required: false
    },
    clientEmail: {
        type: String,
        required: true
    },
    clientPhone: {
        type: String,
        default: null,
        trim: true
    },
    amount: {
        type: Number,
        required: true
    },
    dueDate: {
        type: Date,
        required: true
    },
    paymentLink: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['draft', 'sent', 'paid', 'overdue'],
        default: 'draft'
    },
    reminderChannels: {
        type: [String],
        enum: ['email', 'sms', 'whatsapp'],
        default: ['email']
    },
    remindersSent: [{
        type: Date
    }]
}, { timestamps: true });

module.exports = mongoose.model('InvoiceReminder', invoiceReminderSchema);
