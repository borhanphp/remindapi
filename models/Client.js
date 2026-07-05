const mongoose = require('mongoose');

const ClientSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    company: { type: String, trim: true },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    notes: { type: String, maxlength: 2000 },
    // Recipient opted out of reminder emails via the unsubscribe link
    emailOptOut: { type: Boolean, default: false },
    emailOptOutAt: Date,
    tags: [{ type: String, trim: true }],
    totalInvoices: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    totalOutstanding: { type: Number, default: 0 },
    lastInvoiceDate: Date,
  },
  { timestamps: true }
);

ClientSchema.index({ organization: 1, email: 1 }, { unique: true });
ClientSchema.index({ userId: 1 });
ClientSchema.index({ organization: 1, name: 1 });

module.exports = mongoose.model('Client', ClientSchema);
