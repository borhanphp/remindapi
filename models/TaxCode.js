const mongoose = require('mongoose');

const taxRateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  rate: { type: Number, required: true, min: 0, max: 100 },
  effectiveFrom: { type: Date, required: true },
  effectiveTo: { type: Date }
}, { _id: true });

const taxCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  type: { type: String, enum: ['VAT', 'GST', 'SalesTax', 'ServiceTax', 'Other'], default: 'VAT' },
  jurisdiction: { type: String, trim: true },
  rates: [taxRateSchema],
  isActive: { type: Boolean, default: true },
  isCompound: { type: Boolean, default: false },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

taxCodeSchema.index({ organization: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('TaxCode', taxCodeSchema);


