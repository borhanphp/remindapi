const mongoose = require('mongoose');

const SaleReturnSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: false
    },
    returnNumber: {
      type: String,
      unique: true,
      required: true
    },
    saleInvoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SaleInvoice',
      required: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true
    },
    returnDate: {
      type: Date,
      required: true,
      default: Date.now
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
      reason: {
        type: String,
        required: true,
        enum: [
          'defective',
          'wrong-item',
          'not-as-described',
          'damaged',
          'other'
        ]
      },
      restockable: {
        type: Boolean,
        required: true,
        default: true
      },
      notes: String
    }],
    status: {
      type: String,
      required: true,
      enum: ['pending', 'inspected', 'approved', 'rejected', 'completed', 'cancelled'],
      default: 'pending'
    },
    statusHistory: [{
      status: {
        type: String,
        required: true
      },
      note: String,
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    refundAmount: {
      type: Number,
      required: true
    },
    refundMethod: {
      type: String,
      required: true,
      enum: ['credit-note', 'bank-transfer', 'original-payment-method']
    },
    refundStatus: {
      type: String,
      required: true,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending'
    },
    creditNote: {
      number: String,
      amount: Number,
      issuedDate: Date,
      status: {
        type: String,
        enum: ['draft', 'issued', 'void'],
        default: 'draft'
      }
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true
    },
    attachments: [{
      type: {
        type: String,
        enum: ['credit-note', 'inspection-report', 'other'],
        required: true
      },
      filename: String,
      path: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      },
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }],
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
  { timestamps: true }
);

// Pre-save middleware to generate return number
SaleReturnSchema.pre('save', async function(next) {
  if (this.isNew && !this.returnNumber) {
    const count = await this.constructor.countDocuments();
    this.returnNumber = `RET${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Method to update status with history
SaleReturnSchema.methods.updateStatus = async function(newStatus, note, userId) {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    note,
    updatedBy: userId,
    timestamp: new Date()
  });
  await this.save();
};

// Method to generate credit note
SaleReturnSchema.methods.generateCreditNote = async function(userId) {
  if (this.refundMethod !== 'credit-note') {
    throw new Error('Refund method is not set to credit note');
  }

  const count = await this.constructor.countDocuments({
    'creditNote.number': { $exists: true }
  });
  
  this.creditNote = {
    number: `CN${String(count + 1).padStart(6, '0')}`,
    amount: this.refundAmount,
    issuedDate: new Date(),
    status: 'issued'
  };
  
  await this.save();
  return this.creditNote;
};

module.exports = mongoose.model('SaleReturn', SaleReturnSchema); 