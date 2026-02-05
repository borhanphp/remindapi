const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, trim: true },
  phone: { type: String, trim: true },
  company: { type: String, trim: true },
  source: { type: String, trim: true },
  status: { type: String, enum: ['new', 'contacted', 'qualified', 'unqualified'], default: 'new', index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  tags: [{ type: String, trim: true }],
  score: { type: Number, default: 0 },
  notes: { type: String, trim: true },
  country: { type: String, trim: true },
  consent: { type: Boolean, default: false },
  consentAt: { type: Date },
  convertedAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
  convertedContact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
  convertedAt: { type: Date },
}, { timestamps: true });

LeadSchema.index({ organization: 1, email: 1 });

module.exports = mongoose.model('Lead', LeadSchema);


