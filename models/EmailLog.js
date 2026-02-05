const mongoose = require('mongoose');

const EmailLogSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
  
  // Source
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailCampaign', index: true },
  sequence: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailSequence', index: true },
  sequenceEnrollment: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailSequenceEnrollment' },
  template: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailTemplate' },
  
  // Email details
  to: { type: String, required: true, trim: true, index: true },
  from: { type: String, trim: true },
  subject: { type: String, trim: true },
  body: { type: String },
  bodyHtml: { type: String },
  
  // Recipient
  recipientType: { type: String, enum: ['lead', 'contact', 'customer', 'other'] },
  recipientId: { type: mongoose.Schema.Types.ObjectId, index: true },
  recipientName: { type: String, trim: true },
  
  // Status
  status: { 
    type: String, 
    enum: ['queued', 'sending', 'sent', 'delivered', 'bounced', 'failed'], 
    default: 'queued', 
    index: true 
  },
  
  // Timestamps
  queuedAt: { type: Date, default: Date.now },
  sentAt: { type: Date, index: true },
  deliveredAt: { type: Date },
  bouncedAt: { type: Date },
  failedAt: { type: Date },
  
  // Tracking
  opened: { type: Boolean, default: false },
  openedAt: { type: Date },
  openCount: { type: Number, default: 0 },
  lastOpenedAt: { type: Date },
  
  clicked: { type: Boolean, default: false },
  clickedAt: { type: Date },
  clickCount: { type: Number, default: 0 },
  lastClickedAt: { type: Date },
  clickedLinks: [{ 
    url: String, 
    clickedAt: Date,
    count: { type: Number, default: 1 }
  }],
  
  replied: { type: Boolean, default: false },
  repliedAt: { type: Date },
  
  // Error handling
  error: { type: String },
  bounceType: { type: String, enum: ['hard', 'soft', 'transient'] },
  bounceReason: { type: String },
  
  // Additional data
  messageId: { type: String, trim: true }, // From email provider
  trackingId: { type: String, unique: true, sparse: true }, // For tracking pixel
  
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
}, { timestamps: true });

EmailLogSchema.index({ organization: 1, status: 1, sentAt: -1 });
EmailLogSchema.index({ organization: 1, campaign: 1 });
EmailLogSchema.index({ trackingId: 1 });

module.exports = mongoose.model('EmailLog', EmailLogSchema);
