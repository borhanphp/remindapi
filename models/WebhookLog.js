const mongoose = require('mongoose');

const webhookLogSchema = new mongoose.Schema({
  webhook: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Webhook',
    required: true
  },
  event: {
    type: String,
    required: true
  },
  payload: mongoose.Schema.Types.Mixed,
  statusCode: Number,
  responseBody: String,
  success: {
    type: Boolean,
    default: false
  },
  error: String,
  duration: Number
}, { timestamps: true });

webhookLogSchema.index({ webhook: 1, createdAt: -1 });
webhookLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('WebhookLog', webhookLogSchema);
