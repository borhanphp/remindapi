const mongoose = require('mongoose');

const PayrollSettingsSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true, unique: true },
  payFrequency: { type: String, enum: ['monthly', 'biweekly', 'weekly'], default: 'monthly' },
  incomeTaxBrackets: [{ upTo: Number, rate: Number }],
  socialSecurityRate: { type: Number, default: 0 },
  healthInsuranceFixed: { type: Number, default: 0 },
  preTaxDeductionsKeys: [{ type: String }],
  postTaxDeductionsKeys: [{ type: String }],
  workingDaysPerMonth: { type: Number, default: 22 }
}, { timestamps: true });

module.exports = mongoose.model('PayrollSettings', PayrollSettingsSchema);


