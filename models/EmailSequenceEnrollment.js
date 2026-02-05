const mongoose = require('mongoose');

const EmailSequenceEnrollmentSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
  sequence: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailSequence', required: true, index: true },
  
  // Recipient info
  recipientType: { type: String, enum: ['lead', 'contact', 'customer'], required: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  recipientEmail: { type: String, required: true, trim: true },
  recipientName: { type: String, trim: true },
  
  // Status
  status: { 
    type: String, 
    enum: ['active', 'completed', 'paused', 'exited', 'failed'], 
    default: 'active', 
    index: true 
  },
  
  // Progress tracking
  currentStep: { type: Number, default: 0 },
  nextStepAt: { type: Date },
  enrolledAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  exitedAt: { type: Date },
  exitReason: { type: String, trim: true }, // 'replied', 'clicked', 'converted', 'unsubscribed', 'manual'
  
  // Step completion tracking
  completedSteps: [{
    stepId: { type: mongoose.Schema.Types.ObjectId },
    stepOrder: { type: Number },
    sentAt: { type: Date },
    emailLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailLog' },
  }],
  
  // Analytics
  totalEmailsSent: { type: Number, default: 0 },
  totalOpens: { type: Number, default: 0 },
  totalClicks: { type: Number, default: 0 },
  replied: { type: Boolean, default: false },
  repliedAt: { type: Date },
  converted: { type: Boolean, default: false },
  convertedAt: { type: Date },
  
  enrolledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
}, { timestamps: true });

EmailSequenceEnrollmentSchema.index({ organization: 1, sequence: 1, status: 1 });
EmailSequenceEnrollmentSchema.index({ organization: 1, recipientType: 1, recipientId: 1 });
EmailSequenceEnrollmentSchema.index({ nextStepAt: 1, status: 1 }); // For cron job processing

module.exports = mongoose.model('EmailSequenceEnrollment', EmailSequenceEnrollmentSchema);
