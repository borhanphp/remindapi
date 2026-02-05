const mongoose = require('mongoose');

const ProposalSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
  title: { type: String, required: true, trim: true },
  deal: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal', index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', index: true },
  content: { type: String },
  status: { type: String, enum: ['draft', 'sent', 'viewed', 'signed', 'declined'], default: 'draft', index: true },
  signedAt: { type: Date },
  sendToEmail: { type: String, trim: true },
  publicToken: { type: String, index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
}, { timestamps: true });

ProposalSchema.index({ organization: 1, status: 1 });

module.exports = mongoose.model('Proposal', ProposalSchema);


