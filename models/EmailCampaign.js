const mongoose = require('mongoose');

const EmailCampaignSchema = new mongoose.Schema({
  organization: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Organization', 
    index: true, 
    required: true 
  },
  
  // Campaign details
  name: { type: String, required: true, trim: true },
  subject: { type: String, required: true, trim: true },
  body: { type: String },
  bodyHtml: { type: String },
  
  // Template reference
  template: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailTemplate' },
  
  // Recipients
  recipientType: { 
    type: String, 
    enum: ['list', 'segment', 'all'], 
    default: 'list',
    index: true 
  },
  segment: { type: mongoose.Schema.Types.ObjectId, ref: 'Segment', index: true },
  recipientList: [{ 
    email: { type: String, trim: true, lowercase: true },
    name: { type: String, trim: true },
    recipientType: { type: String, enum: ['lead', 'contact', 'customer'] },
    recipientId: { type: mongoose.Schema.Types.ObjectId }
  }],
  totalRecipients: { type: Number, default: 0 },
  
  // Status and scheduling
  status: { 
    type: String, 
    enum: ['draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'], 
    default: 'draft',
    index: true 
  },
  scheduledAt: { type: Date, index: true },
  sentAt: { type: Date },
  completedAt: { type: Date },
  
  // Sender details
  fromName: { type: String, trim: true },
  fromEmail: { type: String, trim: true },
  replyTo: { type: String, trim: true },
  
  // Tracking settings
  trackOpens: { type: Boolean, default: true },
  trackClicks: { type: Boolean, default: true },
  
  // Statistics
  stats: {
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    bounced: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    opened: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 },
    unsubscribed: { type: Number, default: 0 },
    openRate: { type: Number, default: 0 },
    clickRate: { type: Number, default: 0 },
    bounceRate: { type: Number, default: 0 }
  },
  
  // Meta
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  tags: [{ type: String, trim: true }],
  notes: { type: String, trim: true }
  
}, { timestamps: true });

EmailCampaignSchema.index({ organization: 1, status: 1 });
EmailCampaignSchema.index({ organization: 1, createdAt: -1 });

module.exports = mongoose.model('EmailCampaign', EmailCampaignSchema);

