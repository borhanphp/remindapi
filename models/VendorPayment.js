const mongoose = require('mongoose');

const vendorPaymentSchema = new mongoose.Schema({
  // Payment identification
  paymentNumber: {
    type: String,
    required: true,
    unique: true
  },
  
  // Vendor and bill reference
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  bill: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VendorBill',
    required: true
  },
  
  // Payment details
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  exchangeRate: {
    type: Number,
    default: 1
  },
  paymentDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'check', 'credit_card', 'eft', 'wire_transfer'],
    required: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled', 'failed'],
    default: 'pending'
  },
  
  // Reference information
  reference: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  
  // Payment method specific details
  bankDetails: {
    bankName: String,
    accountNumber: String,
    routingNumber: String,
    transactionId: String
  },
  checkDetails: {
    checkNumber: String,
    checkDate: Date,
    bankName: String
  },
  cardDetails: {
    last4Digits: String,
    cardType: String,
    authorizationCode: String
  },
  
  // Accounting integration
  journalEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JournalEntry'
  },
  
  // Organization
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for performance
vendorPaymentSchema.index({ vendor: 1, paymentDate: -1 });
vendorPaymentSchema.index({ bill: 1 });
vendorPaymentSchema.index({ paymentDate: -1, status: 1 });
vendorPaymentSchema.index({ organization: 1 });
vendorPaymentSchema.index({ paymentNumber: 1 });

// Static method to generate payment number
vendorPaymentSchema.statics.generatePaymentNumber = async function(organizationId) {
  const currentYear = new Date().getFullYear();
  const prefix = `PAY-${currentYear}-`;
  
  const lastPayment = await this.findOne({
    organization: organizationId,
    paymentNumber: { $regex: `^${prefix}` }
  }).sort({ paymentNumber: -1 });
  
  let nextNumber = 1;
  if (lastPayment) {
    const lastNumber = parseInt(lastPayment.paymentNumber.split('-').pop());
    nextNumber = lastNumber + 1;
  }
  
  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
};

module.exports = mongoose.model('VendorPayment', vendorPaymentSchema); 