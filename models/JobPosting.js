const mongoose = require('mongoose');

const JobPostingSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
  title: { type: String, required: true },
  department: { type: String },
  location: { type: String },
  type: { type: String, enum: ['full-time', 'part-time', 'contract', 'internship'], default: 'full-time' },
  salary: { type: String },
  description: { type: String },
  requirements: { type: String },
  status: { type: String, enum: ['active', 'closed', 'draft'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('JobPosting', JobPostingSchema);


