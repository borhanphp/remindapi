const mongoose = require('mongoose');

const ProjectResourceSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true, required: true },
  type: { type: String, enum: ['person', 'equipment', 'tool'], required: true },
  // For people allocations
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  // For equipment/tools or generic resources
  name: { type: String },
  role: { type: String },
  capacityHoursPerWeek: { type: Number, default: 40 },
  startDate: { type: Date },
  endDate: { type: Date },
  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('ProjectResource', ProjectResourceSchema);


