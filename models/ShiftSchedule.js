const mongoose = require('mongoose');

const ShiftScheduleSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', index: true, required: false }, // null = default
  dayOfWeek: { type: Number, min: 0, max: 6, required: true }, // 0=Sun
  start: { type: String, required: true }, // HH:mm
  end: { type: String, required: true },   // HH:mm
  breakMinutes: { type: Number, default: 0 }
}, { timestamps: true });

ShiftScheduleSchema.index({ organization: 1, employee: 1, dayOfWeek: 1 }, { unique: true, partialFilterExpression: { } });

module.exports = mongoose.model('ShiftSchedule', ShiftScheduleSchema);

