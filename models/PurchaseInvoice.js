const mongoose = require('mongoose');

const purchaseInvoiceSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: false
  },
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  purchaseOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder',
    required: true
  },
  grn: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GoodsReceivedNote',
    required: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  supplierInvoiceNumber: {
    type: String,
    required: true
  },
  supplierInvoiceDate: {
    type: Date,
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    taxRate: {
      type: Number,
      default: 0
    },
    taxAmount: {
      type: Number,
      default: 0
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage'
    },
    discountValue: {
      type: Number,
      default: 0
    },
    discountAmount: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      required: true
    }
  }],
  subtotal: {
    type: Number,
    required: true
  },
  totalTax: {
    type: Number,
    default: 0
  },
  totalDiscount: {
    type: Number,
    default: 0
  },
  shippingCost: {
    type: Number,
    default: 0
  },
  otherCharges: [{
    description: String,
    amount: Number
  }],
  currency: {
    type: String,
    default: 'USD'
  },
  exchangeRate: {
    type: Number,
    default: 1
  },
  totalAmount: {
    type: Number,
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'partially_paid', 'paid'],
    default: 'unpaid'
  },
  paymentDue: {
    type: Number,
    default: 0
  },
  payments: [{
    date: {
      type: Date,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    method: {
      type: String,
      required: true
    },
    reference: String,
    notes: String,
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected'],
    default: 'draft'
  },
  statusHistory: [{
    from: {
      type: String,
      required: true
    },
    to: {
      type: String,
      required: true
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    changedAt: {
      type: Date,
      default: Date.now,
      required: true
    },
    note: String
  }],
  attachments: [{
    filename: String,
    path: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvalDate: Date,
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectionDate: Date,
  rejectionReason: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Auto-generate invoice number
purchaseInvoiceSchema.pre('save', async function(next) {
  if (!this.invoiceNumber) {
    const count = await mongoose.model('PurchaseInvoice').countDocuments();
    this.invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
  }
  this.updatedAt = new Date();
  next();
});

// Calculate totals before saving
purchaseInvoiceSchema.pre('save', function(next) {
  // Calculate item totals
  this.items.forEach(item => {
    // Calculate tax amount
    item.taxAmount = (item.quantity * item.unitPrice * item.taxRate) / 100;

    // Calculate discount amount
    if (item.discountType === 'percentage') {
      item.discountAmount = (item.quantity * item.unitPrice * item.discountValue) / 100;
    } else {
      item.discountAmount = item.discountValue;
    }

    // Calculate total
    item.total = (item.quantity * item.unitPrice) + item.taxAmount - item.discountAmount;
  });

  // Calculate invoice totals
  this.subtotal = this.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  this.totalTax = this.items.reduce((sum, item) => sum + item.taxAmount, 0);
  this.totalDiscount = this.items.reduce((sum, item) => sum + item.discountAmount, 0);
  
  // Calculate other charges total
  const otherChargesTotal = this.otherCharges.reduce((sum, charge) => sum + charge.amount, 0);

  // Calculate total amount
  this.totalAmount = this.subtotal + this.totalTax - this.totalDiscount + this.shippingCost + otherChargesTotal;

  // Calculate payment due
  const totalPaid = this.payments.reduce((sum, payment) => sum + payment.amount, 0);
  this.paymentDue = this.totalAmount - totalPaid;

  // Update payment status
  if (this.paymentDue === 0) {
    this.paymentStatus = 'paid';
  } else if (this.paymentDue === this.totalAmount) {
    this.paymentStatus = 'unpaid';
  } else {
    this.paymentStatus = 'partially_paid';
  }

  next();
});

const PurchaseInvoice = mongoose.model('PurchaseInvoice', purchaseInvoiceSchema);

module.exports = PurchaseInvoice; 