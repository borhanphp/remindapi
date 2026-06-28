const mongoose = require('mongoose');

const RecurringReminderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    clientName: {
        type: String,
        required: [true, 'Client name is required'],
        trim: true
    },
    clientEmail: {
        type: String,
        required: [true, 'Client email is required'],
        trim: true,
        lowercase: true
    },
    clientPhone: {
        type: String,
        trim: true
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0.01, 'Amount must be greater than 0']
    },
    invoicePrefix: {
        type: String,
        default: 'REC',
        trim: true
    },
    paymentLink: {
        type: String,
        trim: true
    },
    frequency: {
        type: String,
        enum: ['weekly', 'biweekly', 'monthly', 'quarterly', 'annually'],
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date
    },
    nextGenerationDate: {
        type: Date,
        required: true
    },
    lastGenerationDate: {
        type: Date
    },
    autoSend: {
        type: Boolean,
        default: true
    },
    reminderChannels: {
        type: [String],
        enum: ['email', 'whatsapp'],
        default: ['email']
    },
    status: {
        type: String,
        enum: ['active', 'paused', 'completed', 'cancelled'],
        default: 'active',
        index: true
    },
    totalGenerated: {
        type: Number,
        default: 0
    },
    generationHistory: [{
        generatedAt: Date,
        invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvoiceReminder' },
        invoiceNumber: String
    }]
}, { timestamps: true });

RecurringReminderSchema.index({ nextGenerationDate: 1, status: 1 });

RecurringReminderSchema.methods.calculateNextDate = function () {
    const current = this.nextGenerationDate || this.startDate;
    const next = new Date(current);

    switch (this.frequency) {
        case 'weekly': next.setDate(next.getDate() + 7); break;
        case 'biweekly': next.setDate(next.getDate() + 14); break;
        case 'monthly': next.setMonth(next.getMonth() + 1); break;
        case 'quarterly': next.setMonth(next.getMonth() + 3); break;
        case 'annually': next.setFullYear(next.getFullYear() + 1); break;
    }

    return next;
};

module.exports = mongoose.model('RecurringReminder', RecurringReminderSchema);
