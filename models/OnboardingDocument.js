const mongoose = require('mongoose');

const OnboardingDocumentSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
  title: { type: String, required: true },
  type: { type: String, enum: ['policy', 'handbook', 'nda', 'form', 'other'], default: 'policy' },
  content: { type: String },
  requiredFor: { type: String, enum: ['all', 'new_hire', 'contractor'], default: 'new_hire' },
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('OnboardingDocument', OnboardingDocumentSchema);


