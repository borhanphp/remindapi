const mongoose = require('mongoose');

const LeaveBalanceSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', index: true, required: true },
  // balances per leave type, e.g., { annual: 12, sick: 7 }
  balances: { type: Map, of: Number, default: {} }
}, { timestamps: true });

LeaveBalanceSchema.index({ organization: 1, employee: 1 }, { unique: true });

module.exports = mongoose.model('LeaveBalance', LeaveBalanceSchema);

