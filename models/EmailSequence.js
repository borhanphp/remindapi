const mongoose = require('mongoose');

const SequenceStepSchema = new mongoose.Schema({
  order: { type: Number, required: true },
  name: { type: String, trim: true },
  delayDays: { type: Number, default: 0 }, // Days after previous step or enrollment
  delayHours: { type: Number, default: 0 },
  subject: { type: String, required: true, trim: true },
  body: { type: String, required: true },
  bodyHtml: { type: String },
  template: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailTemplate' },
}, { _id: true });

const EmailSequenceSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  
  // Sequence steps
  steps: [SequenceStepSchema],
  
  // Status
  status: { 
    type: String, 
    enum: ['draft', 'active', 'paused', 'archived'], 
    default: 'draft', 
    index: true 
  },
  
  // Enrollment settings
  enrollmentTrigger: {
    type: String,
    enum: ['manual', 'lead_created', 'lead_status_change', 'deal_created', 'deal_stage_change', 'segment'],
    default: 'manual'
  },
  triggerConditions: { type: Object, default: {} }, // Additional conditions
  segment: { type: mongoose.Schema.Types.ObjectId, ref: 'Segment' },
  
  // Exit conditions
  exitOnReply: { type: Boolean, default: true },
  exitOnClick: { type: Boolean, default: false },
  exitOnConversion: { type: Boolean, default: true },
  
  // Settings
  fromName: { type: String, trim: true },
  fromEmail: { type: String, trim: true },
  replyTo: { type: String, trim: true },
  
  // Analytics
  stats: {
    enrolled: { type: Number, default: 0 },
    active: { type: Number, default: 0 },
    completed: { type: Number, default: 0 },
    unsubscribed: { type: Number, default: 0 },
    replied: { type: Number, default: 0 },
    converted: { type: Number, default: 0 },
  },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  tags: [{ type: String, trim: true }],
  
}, { timestamps: true });

EmailSequenceSchema.index({ organization: 1, status: 1 });

module.exports = mongoose.model('EmailSequence', EmailSequenceSchema);
