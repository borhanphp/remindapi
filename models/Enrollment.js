const mongoose = require('mongoose');

const EnrollmentSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  enrolledDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['enrolled', 'in-progress', 'completed', 'dropped', 'failed'], default: 'enrolled' },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  startedDate: { type: Date },
  completedDate: { type: Date },
  grade: { type: String },
  score: { type: Number },
  certificateUrl: { type: String },
  feedback: { type: String },
  rating: { type: Number, min: 1, max: 5 }
}, { timestamps: true });

module.exports = mongoose.model('Enrollment', EnrollmentSchema);

