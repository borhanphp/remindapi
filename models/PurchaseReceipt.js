const mongoose = require('mongoose');

const PurchaseReceiptSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: false // Temporarily optional during migration
    },
    receiptNumber: {
      type: String,
      required: true
    },
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      required: [true, 'Purchase order is required']
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: [true, 'Supplier is required']
    },
    receiptDate: {
      type: Date,
      default: Date.now,
      required: true
    },
    deliveryNote: {
      type: String,
      trim: true
    },
    invoiceNumber: {
      type: String,
      trim: true
    },
    items: [{
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      orderedQuantity: {
        type: Number,
        required: true,
        min: [0, 'Ordered quantity cannot be negative']
      },
      receivedQuantity: {
        type: Number,
        required: true,
        min: [0, 'Received quantity cannot be negative']
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
      condition: {
        type: String,
        enum: ['good', 'damaged', 'expired', 'defective'],
        default: 'good'
      },
      batchNumber: {
        type: String,
        trim: true
      },
      expiryDate: {
        type: Date
      },
      serialNumbers: [{
        type: String,
        trim: true
      }],
      notes: {
        type: String,
        maxlength: [500, 'Notes cannot be more than 500 characters']
      }
    }],
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: [true, 'Warehouse is required']
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'rejected'],
      default: 'pending'
    },
    qualityCheck: {
      performed: {
        type: Boolean,
        default: false
      },
      performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      performedAt: {
        type: Date
      },
      result: {
        type: String,
        enum: ['passed', 'failed', 'conditional'],
        default: 'passed'
      },
      notes: {
        type: String,
        maxlength: [1000, 'Quality check notes cannot be more than 1000 characters']
      }
    },
    discrepancies: [{
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      type: {
        type: String,
        enum: ['quantity_shortage', 'quantity_excess', 'damaged_goods', 'wrong_product', 'quality_issue'],
        required: true
      },
      description: {
        type: String,
        required: true,
        maxlength: [500, 'Description cannot be more than 500 characters']
      },
      expectedQuantity: {
        type: Number,
        min: [0, 'Expected quantity cannot be negative']
      },
      actualQuantity: {
        type: Number,
        min: [0, 'Actual quantity cannot be negative']
      },
      resolved: {
        type: Boolean,
        default: false
      },
      resolution: {
        type: String,
        maxlength: [500, 'Resolution cannot be more than 500 characters']
      },
      resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      resolvedAt: {
        type: Date
      }
    }],
    totalAmount: {
      type: Number,
      required: true,
      min: [0, 'Total amount cannot be negative']
    },
    notes: {
      type: String,
      maxlength: [1000, 'Notes cannot be more than 1000 characters']
    },
    attachments: [{
      filename: String,
      originalName: String,
      path: String,
      size: Number,
      mimetype: String,
      type: {
        type: String,
        enum: ['delivery_note', 'invoice', 'quality_certificate', 'photo', 'other'],
        default: 'other'
      }
    }],
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: {
      type: Date
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rejectedAt: {
      type: Date
    },
    rejectionReason: {
      type: String,
      maxlength: [500, 'Rejection reason cannot be more than 500 characters']
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for total received quantity
PurchaseReceiptSchema.virtual('totalReceivedQuantity').get(function() {
  return this.items.reduce((total, item) => total + item.receivedQuantity, 0);
});

// Virtual for checking if there are any discrepancies
PurchaseReceiptSchema.virtual('hasDiscrepancies').get(function() {
  return this.discrepancies && this.discrepancies.length > 0;
});

// Virtual for checking if all discrepancies are resolved
PurchaseReceiptSchema.virtual('allDiscrepanciesResolved').get(function() {
  if (!this.discrepancies || this.discrepancies.length === 0) return true;
  return this.discrepancies.every(discrepancy => discrepancy.resolved);
});

// Pre-save middleware to generate receipt number
PurchaseReceiptSchema.pre('save', async function(next) {
  if (this.isNew && !this.receiptNumber) {
    const count = await mongoose.model('PurchaseReceipt').countDocuments();
    this.receiptNumber = `GRN${String(count + 1).padStart(6, '0')}`;
  }
  
  // Calculate total amount
  this.totalAmount = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  
  next();
});

// Post-save middleware to update purchase order received quantities
PurchaseReceiptSchema.post('save', async function(doc) {
  if (doc.status === 'completed') {
    try {
      const PurchaseOrder = mongoose.model('PurchaseOrder');
      const purchaseOrder = await PurchaseOrder.findById(doc.purchaseOrder);
      
      if (purchaseOrder) {
        // Update received quantities in purchase order
        doc.items.forEach(receiptItem => {
          const orderItem = purchaseOrder.items.find(
            item => item.product.toString() === receiptItem.product.toString()
          );
          if (orderItem) {
            orderItem.receivedQuantity += receiptItem.receivedQuantity;
          }
        });
        
        await purchaseOrder.save();
      }
    } catch (error) {
      console.error('Error updating purchase order:', error);
    }
  }
});

// Add text index for search
PurchaseReceiptSchema.index({ 
  receiptNumber: 'text',
  deliveryNote: 'text',
  invoiceNumber: 'text',
  notes: 'text'
});

// Add compound indexes for common queries
PurchaseReceiptSchema.index({ purchaseOrder: 1, status: 1 });
PurchaseReceiptSchema.index({ supplier: 1, status: 1 });
PurchaseReceiptSchema.index({ warehouse: 1, status: 1 });
PurchaseReceiptSchema.index({ receiptDate: -1 });
PurchaseReceiptSchema.index({ receivedBy: 1, status: 1 });

module.exports = mongoose.model('PurchaseReceipt', PurchaseReceiptSchema); 