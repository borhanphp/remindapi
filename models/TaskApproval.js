const mongoose = require('mongoose');

const TaskApprovalSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', index: true, required: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending','approved','rejected'], default: 'pending', index: true },
  decisionAt: { type: Date },
  note: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('TaskApproval', TaskApprovalSchema);


