const mongoose = require('mongoose');

const DealSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
  title: { type: String, required: true, trim: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', index: true },
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  amount: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },
  stage: { type: String, default: 'prospecting', index: true },
  lostReason: { type: String, trim: true },
  pipelineId: { type: mongoose.Schema.Types.ObjectId, index: true },
  assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
  position: { type: Number, default: 0, index: true },
  expectedCloseDate: { type: Date },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  tags: [{ type: String, trim: true }],
  notes: { type: String, trim: true },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
}, { timestamps: true });

DealSchema.index({ organization: 1, stage: 1 });

module.exports = mongoose.model('Deal', DealSchema);


