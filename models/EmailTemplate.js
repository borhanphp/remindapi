const mongoose = require('mongoose');

const EmailTemplateSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
  name: { type: String, required: true, trim: true },
  subject: { type: String, required: true, trim: true },
  body: { type: String, required: true },
  bodyHtml: { type: String },
  category: { type: String, trim: true, enum: ['marketing', 'sales', 'support', 'transactional', 'other'], default: 'marketing' },
  variables: [{ type: String, trim: true }], // e.g., ['firstName', 'company', 'dealAmount']
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  lastUsed: { type: Date },
  usageCount: { type: Number, default: 0 },
  tags: [{ type: String, trim: true }],
}, { timestamps: true });

EmailTemplateSchema.index({ organization: 1, name: 1 });
EmailTemplateSchema.index({ organization: 1, category: 1 });

module.exports = mongoose.model('EmailTemplate', EmailTemplateSchema);
