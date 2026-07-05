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
    }],
    portalToken: {
        type: String,
        unique: true,
        sparse: true
    },
    viewedAt: {
        type: Date,
        default: null
    },
    viewCount: {
        type: Number,
        default: 0
    },
    currency: {
        type: String,
        default: 'USD',
        uppercase: true,
    },
    lateFee: {
        applied: { type: Boolean, default: false },
        amount: { type: Number, default: 0 },
        appliedAt: Date,
    },
    paidAmount: {
        type: Number,
        default: 0,
    },
    paidAt: Date,
    paymentMethod: {
        type: String,
        enum: ['manual', 'stripe', 'paypal', 'portal', null],
        default: null,
    },
    stripePaymentIntentId: String,
    paypalOrderId: String,
    // Set when the client claims payment from the portal; the owner confirms
    // via the mark-as-paid endpoint. Claiming does NOT change status.
    paymentClaim: {
        claimedAt: Date,
        note: { type: String, maxlength: 500 },
    },
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
        default: null,
    },
}, { timestamps: true });

invoiceReminderSchema.index({ status: 1, dueDate: 1 });
invoiceReminderSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('InvoiceReminder', invoiceReminderSchema);
