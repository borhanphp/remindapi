const mongoose = require('mongoose');

const HolidaySchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
  date: { type: Date, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['public', 'company', 'optional', 'other'], default: 'company' },
  description: { type: String },
  recurring: { type: Boolean, default: false }, // Annual recurring holiday
  working: { type: Boolean, default: false } // false = non-working day
}, { timestamps: true });

HolidaySchema.index({ organization: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Holiday', HolidaySchema);

