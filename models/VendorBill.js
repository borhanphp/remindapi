const mongoose = require('mongoose');

const vendorBillSchema = new mongoose.Schema({
  // Bill identification
  billNumber: {
    type: String,
    required: true,
    unique: true
  },
  vendorInvoiceNumber: {
    type: String,
    required: true,
    trim: true
  },
  
  // Vendor information
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  
  // Bill details
  billDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: true
  },
  paymentTerms: {
    type: String,
    enum: ['net_15', 'net_30', 'net_45', 'net_60', 'due_on_receipt', 'custom'],
    default: 'net_30'
  },
  
  // Financial information
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  balanceAmount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['draft', 'pending', 'partially_paid', 'paid', 'overdue', 'cancelled'],
    default: 'pending'
  },
  
  // Line items
  lineItems: [{
    description: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      default: 1,
      min: 0
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account'
    }
  }],
  
  // Additional information
  memo: {
    type: String,
    trim: true
  },
  attachments: [{
    filename: String,
    originalName: String,
    path: String,
    mimetype: String,
    size: Number,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Reference to purchase order if applicable
  purchaseOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder'
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
vendorBillSchema.index({ vendor: 1, billDate: -1 });
vendorBillSchema.index({ dueDate: 1, status: 1 });
vendorBillSchema.index({ billNumber: 1 });
vendorBillSchema.index({ organization: 1 });
vendorBillSchema.index({ status: 1, dueDate: 1 });

// Virtual for days overdue
vendorBillSchema.virtual('daysOverdue').get(function() {
  if (this.status === 'paid' || this.status === 'cancelled') return 0;
  const today = new Date();
  const diffTime = today - this.dueDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
});

// Pre-save middleware to calculate balance and update status
vendorBillSchema.pre('save', function(next) {
  // Calculate balance
  this.balanceAmount = this.totalAmount - this.paidAmount;
  
  // Update status based on payments
  if (this.balanceAmount <= 0) {
    this.status = 'paid';
  } else if (this.paidAmount > 0) {
    this.status = 'partially_paid';
  } else if (this.dueDate < new Date() && this.status !== 'paid') {
    this.status = 'overdue';
  }
  
  next();
});

// Method to calculate line item totals
vendorBillSchema.methods.calculateTotals = function() {
  this.subtotal = this.lineItems.reduce((sum, item) => sum + item.amount, 0);
  this.totalAmount = this.subtotal + this.taxAmount;
  this.balanceAmount = this.totalAmount - this.paidAmount;
};

// Static method to generate bill number
vendorBillSchema.statics.generateBillNumber = async function(organizationId) {
  const currentYear = new Date().getFullYear();
  const prefix = `BILL-${currentYear}-`;
  
  const lastBill = await this.findOne({
    organization: organizationId,
    billNumber: { $regex: `^${prefix}` }
  }).sort({ billNumber: -1 });
  
  let nextNumber = 1;
  if (lastBill) {
    const lastNumber = parseInt(lastBill.billNumber.split('-').pop());
    nextNumber = lastNumber + 1;
  }
  
  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
};

module.exports = mongoose.model('VendorBill', vendorBillSchema); 