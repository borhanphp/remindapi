const mongoose = require('mongoose');

const EstimateSchema = new mongoose.Schema(
  {
    estimateNumber: {
      type: String,
      required: [true, 'Estimate number is required'],
      unique: true,
      trim: true,
      index: true
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
    estimateDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    validityDate: {
      type: Date,
      required: true
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
    status: {
      type: String,
      enum: ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'converted'],
      default: 'draft',
      index: true
    },
    acceptedAt: {
      type: Date
    },
    rejectedAt: {
      type: Date
    },
    rejectionReason: {
      type: String
    },
    convertedInvoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CustomInvoice'
    },
    convertedAt: {
      type: Date
    },
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
EstimateSchema.index({ estimateNumber: 'text' });
EstimateSchema.index({ estimateDate: -1 });
EstimateSchema.index({ validityDate: 1 });
EstimateSchema.index({ status: 1, validityDate: 1 });
EstimateSchema.index({ organization: 1, customer: 1 });

// Virtual for checking if expired
EstimateSchema.virtual('isExpired').get(function () {
  return this.status === 'sent' && new Date() > this.validityDate;
});

// Auto-update status to expired if past validity date
EstimateSchema.pre('save', function (next) {
  if (this.isExpired && this.status === 'sent') {
    this.status = 'expired';
  }
  next();
});

module.exports = mongoose.model('Estimate', EstimateSchema);

