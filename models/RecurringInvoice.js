const mongoose = require('mongoose');

const RecurringInvoiceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Recurring invoice name is required'],
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
      required: [true, 'Customer is required'],
      index: true
    },
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InvoiceTemplate',
      required: true
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semi-annually', 'annually'],
      required: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date // Optional - if not set, continues indefinitely
    },
    nextGenerationDate: {
      type: Date,
      required: true
    },
    lastGenerationDate: {
      type: Date
    },
    invoiceNumberPrefix: {
      type: String,
      default: 'REC'
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
    shippingCost: {
      type: Number,
      default: 0,
      min: [0, 'Shipping cost cannot be negative']
    },
    totalAmount: {
      type: Number,
      required: true,
      min: [0, 'Total amount cannot be negative']
    },
    notes: {
      type: String
    },
    terms: {
      type: String
    },
    autoSend: {
      type: Boolean,
      default: false
    },
    emailRecipients: [
      {
        type: String,
        trim: true
      }
    ],
    status: {
      type: String,
      enum: ['active', 'paused', 'completed', 'cancelled'],
      default: 'active',
      index: true
    },
    generationHistory: [
      {
        generatedAt: { type: Date, required: true },
        invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomInvoice' },
        invoiceNumber: { type: String },
        sent: { type: Boolean, default: false },
        sentAt: { type: Date },
        error: { type: String }
      }
    ],
    totalGenerated: {
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
RecurringInvoiceSchema.index({ nextGenerationDate: 1, status: 1 });
RecurringInvoiceSchema.index({ organization: 1, customer: 1 });
RecurringInvoiceSchema.index({ status: 1 });

// Method to calculate next generation date
RecurringInvoiceSchema.methods.calculateNextDate = function () {
  const currentDate = this.nextGenerationDate || this.startDate;
  const nextDate = new Date(currentDate);

  switch (this.frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'biweekly':
      nextDate.setDate(nextDate.getDate() + 14);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case 'semi-annually':
      nextDate.setMonth(nextDate.getMonth() + 6);
      break;
    case 'annually':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
  }

  return nextDate;
};

// Check if recurring invoice should be marked as completed
RecurringInvoiceSchema.pre('save', function (next) {
  if (this.endDate && new Date() > this.endDate && this.status === 'active') {
    this.status = 'completed';
  }
  next();
});

module.exports = mongoose.model('RecurringInvoice', RecurringInvoiceSchema);

