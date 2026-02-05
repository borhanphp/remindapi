const mongoose = require('mongoose');

const EmailUnsubscribeSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
  
  // Unsubscribed email
  email: { type: String, required: true, trim: true, lowercase: true, index: true },
  
  // Related entity
  recipientType: { type: String, enum: ['lead', 'contact', 'customer', 'other'] },
  recipientId: { type: mongoose.Schema.Types.ObjectId, index: true },
  
  // Unsubscribe details
  reason: { type: String, trim: true },
  reasonCategory: { 
    type: String, 
    enum: ['too_frequent', 'not_relevant', 'never_subscribed', 'spam', 'other'],
    default: 'other'
  },
  feedback: { type: String, trim: true },
  
  // Source
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailCampaign' },
  sequence: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailSequence' },
  emailLog: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailLog' },
  
  // Unsubscribe method
  method: { 
    type: String, 
    enum: ['link', 'reply', 'complaint', 'manual'], 
    default: 'link' 
  },
  
  // Status
  isActive: { type: Boolean, default: true }, // Can be reactivated
  resubscribedAt: { type: Date },
  
  // Additional
  ipAddress: { type: String, trim: true },
  userAgent: { type: String, trim: true },
  
  unsubscribedAt: { type: Date, default: Date.now, index: true },
  
}, { timestamps: true });

EmailUnsubscribeSchema.index({ organization: 1, email: 1 }, { unique: true });
EmailUnsubscribeSchema.index({ organization: 1, isActive: 1 });

module.exports = mongoose.model('EmailUnsubscribe', EmailUnsubscribeSchema);
