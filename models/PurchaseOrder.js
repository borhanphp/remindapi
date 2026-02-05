const mongoose = require('mongoose');

const PurchaseOrderSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: false // Temporarily optional during migration
    },
    orderNumber: {
      type: String,
      required: true
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: [true, 'Supplier is required']
    },
    orderDate: {
      type: Date,
      default: Date.now,
      required: true
    },
    expectedDeliveryDate: {
      type: Date
    },
    actualDeliveryDate: {
      type: Date
    },
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'approved', 'ordered', 'partially_received', 'received', 'cancelled'],
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
      note: {
        type: String,
        maxlength: [500, 'Status change note cannot be more than 500 characters']
      }
    }],
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
      receivedQuantity: {
        type: Number,
        default: 0,
        min: [0, 'Received quantity cannot be negative']
      },
      pendingQuantity: {
        type: Number,
        default: function() {
          return this.quantity - this.receivedQuantity;
        }
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
      type: String,
      maxlength: [1000, 'Notes cannot be more than 1000 characters']
    },
    terms: {
      type: String,
      maxlength: [1000, 'Terms cannot be more than 1000 characters']
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: [true, 'Warehouse is required']
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
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: {
      type: Date
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

// Virtual for calculating pending quantity for each item
PurchaseOrderSchema.virtual('totalPendingQuantity').get(function() {
  if (!this.items || !Array.isArray(this.items)) return 0;
  return this.items.reduce((total, item) => total + ((item.quantity || 0) - (item.receivedQuantity || 0)), 0);
});

// Virtual for checking if order is fully received
PurchaseOrderSchema.virtual('isFullyReceived').get(function() {
  if (!this.items || !Array.isArray(this.items) || this.items.length === 0) return false;
  return this.items.every(item => (item.receivedQuantity || 0) >= (item.quantity || 0));
});

// Virtual for checking if order is partially received
PurchaseOrderSchema.virtual('isPartiallyReceived').get(function() {
  if (!this.items || !Array.isArray(this.items) || this.items.length === 0) return false;
  const hasReceivedItems = this.items.some(item => (item.receivedQuantity || 0) > 0);
  const hasPendingItems = this.items.some(item => (item.receivedQuantity || 0) < (item.quantity || 0));
  return hasReceivedItems && hasPendingItems;
});

// Add indexes for organization-specific queries
PurchaseOrderSchema.index({ organization: 1, orderNumber: 1 }, { unique: true });
PurchaseOrderSchema.index({ organization: 1, status: 1 });
PurchaseOrderSchema.index({ organization: 1, supplier: 1 });
PurchaseOrderSchema.index({ organization: 1, createdBy: 1 });

// Pre-save middleware to generate order number
PurchaseOrderSchema.pre('save', async function(next) {
  if (this.isNew && !this.orderNumber) {
    const count = await mongoose.model('PurchaseOrder').countDocuments({ organization: this.organization });
    this.orderNumber = `PO${String(count + 1).padStart(6, '0')}`;
  }
  
  // Update pending quantities for items
  this.items.forEach(item => {
    item.pendingQuantity = item.quantity - item.receivedQuantity;
  });
  
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
  this.totalAmount = this.subtotal - this.discountAmount + this.taxAmount + this.shippingCost;
  
  next();
});

// Pre-save middleware to update status based on received quantities
PurchaseOrderSchema.pre('save', function(next) {
  if (this.status === 'ordered' || this.status === 'partially_received') {
    const totalReceived = this.items.reduce((sum, item) => sum + item.receivedQuantity, 0);
    const totalOrdered = this.items.reduce((sum, item) => sum + item.quantity, 0);
    
    if (totalReceived === 0) {
      this.status = 'ordered';
    } else if (totalReceived >= totalOrdered) {
      this.status = 'received';
      if (!this.actualDeliveryDate) {
        this.actualDeliveryDate = new Date();
      }
    } else {
      this.status = 'partially_received';
    }
  }
  
  next();
});

// Add text index for search
PurchaseOrderSchema.index({ 
  orderNumber: 'text',
  notes: 'text',
  terms: 'text'
});

// Add compound indexes for common queries
PurchaseOrderSchema.index({ supplier: 1, status: 1 });
PurchaseOrderSchema.index({ warehouse: 1, status: 1 });
PurchaseOrderSchema.index({ orderDate: -1 });
PurchaseOrderSchema.index({ expectedDeliveryDate: 1 });
PurchaseOrderSchema.index({ createdBy: 1, status: 1 });

module.exports = mongoose.model('PurchaseOrder', PurchaseOrderSchema); 