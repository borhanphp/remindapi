const mongoose = require('mongoose');

const PayrollEntrySchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  employeeName: { type: String },
  basicSalary: { type: Number, default: 0 },
  // Earnings
  allowances: {
    housing: { type: Number, default: 0 },
    transport: { type: Number, default: 0 },
    medical: { type: Number, default: 0 },
    other: { type: Number, default: 0 }
  },
  overtime: { type: Number, default: 0 },
  bonus: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  // Deductions
  deductions: {
    tax: { type: Number, default: 0 },
    providentFund: { type: Number, default: 0 },
    insurance: { type: Number, default: 0 },
    loanRepayment: { type: Number, default: 0 },
    other: { type: Number, default: 0 }
  },
  totalDeductions: { type: Number, default: 0 },
  // Net
  netSalary: { type: Number, default: 0 },
  // Status
  paymentStatus: { type: String, enum: ['pending', 'paid', 'hold'], default: 'pending' },
  paymentDate: { type: Date },
  paymentMethod: { type: String },
  notes: { type: String }
}, { _id: true });

const PayrollRunSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
  name: { type: String },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  entries: [PayrollEntrySchema],
  // Totals
  totalGross: { type: Number, default: 0 },
  totalDeductions: { type: Number, default: 0 },
  totalNet: { type: Number, default: 0 },
  employeeCount: { type: Number, default: 0 },
  // Status
  status: { type: String, enum: ['draft', 'processing', 'completed', 'paid', 'cancelled'], default: 'draft' },
  processedAt: { type: Date },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paymentDate: { type: Date },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  notes: { type: String }
}, { timestamps: true });

PayrollRunSchema.index({ organization: 1, year: 1, month: 1 });

module.exports = mongoose.model('PayrollRun', PayrollRunSchema);
