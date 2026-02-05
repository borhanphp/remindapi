const mongoose = require('mongoose');

const ProjectExpenseSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true, required: true },
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', index: true },
  milestone: { type: mongoose.Schema.Types.ObjectId, ref: 'Milestone', index: true },
  category: { type: String, enum: ['labor','materials','services','other'], default: 'other', index: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  date: { type: Date, default: Date.now, index: true },
  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }
}, { timestamps: true });

ProjectExpenseSchema.index({ organization: 1, project: 1, date: 1 });

module.exports = mongoose.model('ProjectExpense', ProjectExpenseSchema);


