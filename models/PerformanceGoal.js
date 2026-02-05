const mongoose = require('mongoose');

const KpiSchema = new mongoose.Schema({
  name: { type: String, required: true },
  target: { type: Number, default: 0 },
  current: { type: Number, default: 0 },
  unit: { type: String, default: '' },
  weight: { type: Number, default: 0 }
}, { _id: false });

const PerformanceGoalSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', index: true, required: true },
  title: { type: String, required: true },
  description: { type: String },
  kpis: { type: [KpiSchema], default: [] },
  startDate: { type: Date },
  endDate: { type: Date },
  status: { type: String, enum: ['active', 'completed', 'archived'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('PerformanceGoal', PerformanceGoalSchema);


