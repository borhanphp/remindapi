const mongoose = require('mongoose');

const salePaymentSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: false
  },
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SaleInvoice',
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
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
  paymentMethod: {
    type: String,
    required: true,
    enum: ['cash', 'bank_transfer', 'credit_card', 'check', 'mobile_money']
  },
  paymentDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  reference: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  bankDetails: {
    bankName: String,
    accountNumber: String,
    transactionId: String
  },
  checkDetails: {
    checkNumber: String,
    bankName: String,
    checkDate: Date
  },
  cardDetails: {
    cardType: {
      type: String,
      enum: ['visa', 'mastercard', 'amex', 'discover']
    },
    lastFourDigits: String,
    transactionId: String
  },
  mobileMoneyDetails: {
    provider: String,
    phoneNumber: String,
    transactionId: String
  },
  receiptNumber: {
    type: String,
    unique: true
  },
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

// Generate receipt number before saving
salePaymentSchema.pre('save', async function(next) {
  if (!this.receiptNumber) {
    const lastPayment = await this.constructor.findOne({}, {}, { sort: { 'createdAt': -1 } });
    let nextNumber = 1;
    
    if (lastPayment && lastPayment.receiptNumber) {
      const lastNumber = parseInt(lastPayment.receiptNumber.split('-')[1]);
      nextNumber = lastNumber + 1;
    }
    
    this.receiptNumber = `RCP-${nextNumber.toString().padStart(6, '0')}`;
  }
  next();
});

// Update invoice balance and status after payment
salePaymentSchema.post('save', async function(doc) {
  if (this.status === 'completed') {
    const invoice = await mongoose.model('SaleInvoice').findById(this.invoice);
    if (invoice) {
      invoice.amountPaid += this.amount;
      invoice.balanceAmount = invoice.totalAmount - invoice.amountPaid;
      
      if (invoice.balanceAmount <= 0) {
        invoice.status = 'paid';
      } else if (invoice.amountPaid > 0) {
        invoice.status = 'partially_paid';
      }
      
      await invoice.save();
    }
  }
});

module.exports = mongoose.model('SalePayment', salePaymentSchema); 