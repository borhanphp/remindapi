const mongoose = require('mongoose');

const TaskTemplateSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String },
  // Fields to prefill when using the template
  title: { type: String },
  defaultStatus: { type: String, enum: ['backlog','todo','in-progress','blocked','done'] },
  defaultPriority: { type: String, enum: ['low','medium','high','urgent'] },
  defaultAssignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  defaultDurationDays: { type: Number },
  checklist: [{ label: String, required: { type: Boolean, default: false } }],
}, { timestamps: true });

module.exports = mongoose.model('TaskTemplate', TaskTemplateSchema);


