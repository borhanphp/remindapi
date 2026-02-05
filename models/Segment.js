const mongoose = require('mongoose');

const SegmentSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  criteria: { type: Object, default: {} },
}, { timestamps: true });

SegmentSchema.index({ organization: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Segment', SegmentSchema);


