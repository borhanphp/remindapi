const mongoose = require('mongoose');

const PipelineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  stages: { type: [String], default: [] },
  isDefault: { type: Boolean, default: false }
});

const CrmSettingsSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true, unique: true },
  stages: { type: [String], default: ['prospecting', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] },
  pipelines: { type: [PipelineSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('CrmSettings', CrmSettingsSchema);


