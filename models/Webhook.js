const mongoose = require('mongoose');

const webhookSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  secret: {
    type: String,
    required: true
  },
  events: {
    type: [String],
    enum: [
      'invoice.created',
      'invoice.updated',
      'invoice.paid',
      'invoice.deleted',
      'reminder.sent',
      'invoice.viewed'
    ],
    required: true
  },
  active: {
    type: Boolean,
    default: true
  },
  description: {
    type: String,
    default: ''
  },
  failureCount: {
    type: Number,
    default: 0
  },
  lastDeliveredAt: Date,
  lastFailedAt: Date,
  lastError: String
}, { timestamps: true });

webhookSchema.index({ organization: 1, active: 1 });

module.exports = mongoose.model('Webhook', webhookSchema);
