const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', index: true, required: true },
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  fromEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', index: true },
  relationship: { type: String, enum: ['self', 'manager', 'peer', 'report', 'other'], default: 'other' },
  comments: { type: String },
  rating: { type: Number, min: 0, max: 5 },
  cycle: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Feedback', FeedbackSchema);


