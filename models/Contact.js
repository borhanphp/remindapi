const mongoose = require('mongoose');

const ContactSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
  account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', index: true },
  firstName: { type: String, trim: true },
  lastName: { type: String, trim: true },
  email: { type: String, trim: true, index: true },
  phone: { type: String, trim: true },
  title: { type: String, trim: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  team: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
  tags: [{ type: String, trim: true }],
  notes: { type: String, trim: true },
  consent: { type: Boolean, default: false },
  consentAt: { type: Date },
}, { timestamps: true });

ContactSchema.index({ organization: 1, email: 1 });

module.exports = mongoose.model('Contact', ContactSchema);

