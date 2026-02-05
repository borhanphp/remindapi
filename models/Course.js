const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  title: { type: String, required: true },
  description: { type: String },
  category: { type: String, enum: ['technical', 'soft-skills', 'compliance', 'leadership', 'sales', 'other'], default: 'other' },
  level: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
  duration: { type: Number }, // in hours
  format: { type: String, enum: ['online', 'in-person', 'hybrid'], default: 'online' },
  instructor: { type: String },
  cost: { type: Number, default: 0 },
  maxParticipants: { type: Number },
  startDate: { type: Date },
  endDate: { type: Date },
  status: { type: String, enum: ['draft', 'published', 'completed', 'cancelled'], default: 'draft' },
  skills: [{ type: String }],
  materials: [{
    name: { type: String },
    url: { type: String },
    type: { type: String }
  }],
  prerequisites: [{ type: String }],
  certificationOffered: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Course', CourseSchema);

