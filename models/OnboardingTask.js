const mongoose = require('mongoose');

const OnboardingTaskSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', index: true, required: true },
  document: { type: mongoose.Schema.Types.ObjectId, ref: 'OnboardingDocument', index: true },
  title: { type: String, required: true },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
  signedAt: { type: Date },
  publicToken: { type: String, index: true }
}, { timestamps: true });

module.exports = mongoose.model('OnboardingTask', OnboardingTaskSchema);


