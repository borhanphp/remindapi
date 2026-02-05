const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      unique: true,
      required: true
    },
    salesOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SaleOrder'
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer is required']
    },
    invoiceDate: {
      type: Date,
      default: Date.now,
      required: true
    },
    dueDate: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['draft', 'pending', 'paid', 'partially_paid', 'overdue', 'cancelled'],
      default: 'draft'
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
        min: [1, 'Quantity must be at least 1']
      },
      unitPrice: {
        type: Number,
        required: true,
        min: [0, 'Unit price cannot be negative']
      },
      totalPrice: {
        type: Number,
        required: true,
        min: [0, 'Total price cannot be negative']
      },
      description: {
        type: String,
        trim: true
      }
    }],
    subtotal: {
      type: Number,
      required: true,
      min: [0, 'Subtotal cannot be negative']
    },
    taxRate: {
      type: Number,
      default: 0,
      min: [0, 'Tax rate cannot be negative'],
      max: [100, 'Tax rate cannot exceed 100%']
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: [0, 'Tax amount cannot be negative']
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage'
    },
    discountValue: {
      type: Number,
      default: 0,
      min: [0, 'Discount value cannot be negative']
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: [0, 'Discount amount cannot be negative']
    },
    totalAmount: {
      type: Number,
      required: true,
      min: [0, 'Total amount cannot be negative']
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: [0, 'Amount paid cannot be negative']
    },
    balanceAmount: {
      type: Number,
      default: function() {
        return this.totalAmount - this.amountPaid;
      },
      min: [0, 'Balance amount cannot be negative']
    },
    notes: {
      type: String,
      maxlength: [1000, 'Notes cannot be more than 1000 characters']
    },
    terms: {
      type: String,
      maxlength: [1000, 'Terms cannot be more than 1000 characters']
    },
    paymentTerms: {
      type: String,
      maxlength: [500, 'Payment terms cannot be more than 500 characters']
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    cancelledAt: {
      type: Date
    },
    cancellationReason: {
      type: String,
      maxlength: [500, 'Cancellation reason cannot be more than 500 characters']
    },
    attachments: [{
      filename: String,
      originalName: String,
      path: String,
      size: Number,
      mimetype: String
    }]
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Pre-save middleware to calculate totals and update status
InvoiceSchema.pre('save', async function(next) {
  // Calculate totals
  this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  
  // Calculate discount amount
  if (this.discountType === 'percentage') {
    this.discountAmount = (this.subtotal * this.discountValue) / 100;
  } else {
    this.discountAmount = this.discountValue;
  }
  
  // Calculate tax amount
  const taxableAmount = this.subtotal - this.discountAmount;
  this.taxAmount = (taxableAmount * this.taxRate) / 100;
  
  // Calculate total amount
  this.totalAmount = this.subtotal - this.discountAmount + this.taxAmount;
  
  // Calculate balance amount
  this.balanceAmount = this.totalAmount - this.amountPaid;
  
  // Update status based on payment
  if (this.status !== 'draft' && this.status !== 'cancelled') {
    if (this.balanceAmount <= 0) {
      this.status = 'paid';
    } else if (this.amountPaid > 0) {
      this.status = 'partially_paid';
    } else if (this.dueDate < new Date()) {
      this.status = 'overdue';
    } else {
      this.status = 'pending';
    }
  }
  
  next();
});

module.exports = mongoose.model('Invoice', InvoiceSchema); 