const mongoose = require('mongoose');

const taxReturnSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    type: { type: String, enum: ['VAT', 'GST', 'SalesTax', 'Other'], default: 'VAT' },
    jurisdiction: { type: String, default: '' },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    status: { type: String, enum: ['draft', 'submitted', 'locked'], default: 'draft' },
    figures: {
      salesTaxableAmount: { type: Number, default: 0 },
      salesTaxAmount: { type: Number, default: 0 },
      purchaseTaxableAmount: { type: Number, default: 0 },
      purchaseTaxAmount: { type: Number, default: 0 },
      netTaxPayable: { type: Number, default: 0 }
    },
    references: {
      salesInvoices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SaleInvoice' }],
      purchaseInvoices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseInvoice' }]
    },
    submittedAt: { type: Date },
    submittedReference: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

taxReturnSchema.index({ organization: 1, periodStart: 1, periodEnd: 1, type: 1 }, { unique: false });

module.exports = mongoose.model('TaxReturn', taxReturnSchema);


