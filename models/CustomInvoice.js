const mongoose = require('mongoose');

const CustomInvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: [true, 'Invoice number is required'],
      trim: true
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      index: true
    },
    // For custom (non-database) customers
    isCustomCustomer: {
      type: Boolean,
      default: false
    },
    customCustomer: {
      name: { type: String },
      email: { type: String },
      phone: { type: String },
      address: {
        street: { type: String },
        city: { type: String },
        state: { type: String },
        zipCode: { type: String },
        country: { type: String }
      }
    },
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InvoiceTemplate',
      required: false // Optional - system will use default styling if not provided
    },
    invoiceDate: {
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
      default: 'Net 30'
    },
    currency: {
      code: { type: String, default: 'USD' },
      symbol: { type: String, default: '$' },
      exchangeRate: { type: Number, default: 1 }
    },
    lineItems: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product'
        },
        description: {
          type: String,
          required: true
        },
        quantity: {
          type: Number,
          required: true,
          min: [0, 'Quantity cannot be negative']
        },
        unitPrice: {
          type: Number,
          required: true,
          min: [0, 'Unit price cannot be negative']
        },
        taxRate: {
          type: Number,
          default: 0,
          min: [0, 'Tax rate cannot be negative']
        },
        taxAmount: {
          type: Number,
          default: 0
        },
        discount: {
          type: Number,
          default: 0,
          min: [0, 'Discount cannot be negative']
        },
        totalAmount: {
          type: Number,
          required: true
        }
      }
    ],
    customFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {}
    },
    subtotal: {
      type: Number,
      required: true,
      min: [0, 'Subtotal cannot be negative']
    },
    totalTax: {
      type: Number,
      default: 0,
      min: [0, 'Total tax cannot be negative']
    },
    totalDiscount: {
      type: Number,
      default: 0,
      min: [0, 'Total discount cannot be negative']
    },
    shipping: {
      type: Number,
      default: 0,
      min: [0, 'Shipping cost cannot be negative']
    },
    shippingCost: {
      type: Number,
      default: 0,
      min: [0, 'Shipping cost cannot be negative']
    },
    adjustment: {
      type: Number,
      default: 0
    },
    adjustmentLabel: {
      type: String,
      default: 'Adjustment'
    },
    poNumber: {
      type: String,
      trim: true
    },
    reference: {
      type: String,
      trim: true
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
      default: 0
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled', 'refunded'],
      default: 'draft',
      index: true
    },
    paymentHistory: [
      {
        date: { type: Date, required: true },
        amount: { type: Number, required: true },
        method: { type: String }, // cash, card, bank_transfer, etc.
        reference: { type: String },
        notes: { type: String },
        recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
      }
    ],
    emailHistory: [
      {
        sentAt: { type: Date, required: true },
        sentTo: { type: String, required: true },
        subject: { type: String },
        openedAt: { type: Date },
        status: { type: String, enum: ['sent', 'delivered', 'opened', 'failed'], default: 'sent' },
        errorMessage: { type: String }
      }
    ],
    pdfUrl: {
      type: String
    },
    notes: {
      type: String
    },
    terms: {
      type: String
    },
    internalNotes: {
      type: String
    },
    // Related documents
    relatedEstimate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Estimate'
    },
    relatedSalesOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SaleOrder'
    },
    recurringInvoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RecurringInvoice'
    },
    // Metadata
    lastViewedAt: {
      type: Date
    },
    viewCount: {
      type: Number,
      default: 0
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
  },
  {
    timestamps: true
  }
);

// Indexes
// Compound unique index: invoice number must be unique within each organization
CustomInvoiceSchema.index({ organization: 1, invoiceNumber: 1 }, { unique: true });
CustomInvoiceSchema.index({ invoiceNumber: 'text' });
CustomInvoiceSchema.index({ invoiceDate: -1 });
CustomInvoiceSchema.index({ dueDate: 1 });
CustomInvoiceSchema.index({ status: 1, dueDate: 1 });
CustomInvoiceSchema.index({ organization: 1, customer: 1 });

// Virtual for checking if overdue
CustomInvoiceSchema.virtual('isOverdue').get(function () {
  return this.status !== 'paid' && this.status !== 'cancelled' && new Date() > this.dueDate;
});

// Validation: Ensure either customer or customCustomer is provided
CustomInvoiceSchema.pre('validate', function (next) {
  if (!this.customer && !this.isCustomCustomer) {
    this.invalidate('customer', 'Either customer or custom customer information is required');
  }
  
  if (this.isCustomCustomer && (!this.customCustomer || !this.customCustomer.name || !this.customCustomer.email)) {
    this.invalidate('customCustomer', 'Custom customer must have name and email');
  }
  
  next();
});

// Update balance amount before save
CustomInvoiceSchema.pre('save', function (next) {
  this.balanceAmount = this.totalAmount - this.amountPaid;
  
  // Auto-update status based on payment
  if (this.amountPaid >= this.totalAmount && this.status !== 'paid') {
    this.status = 'paid';
  } else if (this.amountPaid > 0 && this.amountPaid < this.totalAmount && this.status !== 'partial') {
    this.status = 'partial';
  } else if (this.amountPaid === 0 && this.isOverdue && this.status === 'sent') {
    this.status = 'overdue';
  }
  
  next();
});

module.exports = mongoose.model('CustomInvoice', CustomInvoiceSchema);

