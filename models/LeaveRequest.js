const mongoose = require('mongoose');

const LeaveRequestSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', index: true, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  type: { type: String, enum: ['annual', 'sick', 'personal', 'unpaid', 'other'], default: 'annual' },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending' },
  reason: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('LeaveRequest', LeaveRequestSchema);


