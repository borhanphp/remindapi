const mongoose = require('mongoose');

const InterviewSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
  applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'Applicant', index: true, required: true },
  scheduledAt: { type: Date, required: true },
  mode: { type: String, enum: ['onsite', 'video', 'phone'], default: 'video' },
  interviewer: { type: String },
  notes: { type: String },
  status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' }
}, { timestamps: true });

module.exports = mongoose.model('Interview', InterviewSchema);


