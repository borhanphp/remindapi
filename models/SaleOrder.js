const mongoose = require('mongoose');
const Product = require('./Product');
const InventoryTransaction = require('./InventoryTransaction');
const { reserveStock } = require('../utils/inventoryUtils');

const SaleOrderSchema = new mongoose.Schema(
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
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer is required']
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
      enum: ['draft', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'backordered'],
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
      deliveredQuantity: {
        type: Number,
        default: 0,
        min: [0, 'Delivered quantity cannot be negative']
      },
      backorderedQuantity: {
        type: Number,
        default: 0,
        min: [0, 'Backordered quantity cannot be negative']
      },
      pendingQuantity: {
        type: Number,
        default: function() {
          return this.quantity - (this.deliveredQuantity + this.backorderedQuantity);
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
    }],
    reservationInfo: {
      reservedAt: Date,
      reservedItems: [{
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product'
        },
        quantity: Number
      }],
      backorderedItems: [{
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product'
        },
        requested: Number,
        reserved: Number,
        backordered: Number
      }],
      released: {
        type: Boolean,
        default: false
      },
      releasedAt: Date,
      releaseReason: String
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for calculating pending quantity for each item
SaleOrderSchema.virtual('totalPendingQuantity').get(function() {
  if (!this.items || !Array.isArray(this.items)) return 0;
  return this.items.reduce((total, item) => total + ((item.quantity || 0) - (item.deliveredQuantity || 0)), 0);
});

// Virtual for checking if order is fully delivered
SaleOrderSchema.virtual('isFullyDelivered').get(function() {
  if (!this.items || !Array.isArray(this.items) || this.items.length === 0) return false;
  return this.items.every(item => (item.deliveredQuantity || 0) >= (item.quantity || 0));
});

// Virtual for checking if order is partially delivered
SaleOrderSchema.virtual('isPartiallyDelivered').get(function() {
  if (!this.items || !Array.isArray(this.items)) return false;
  return this.items.some(item => (item.deliveredQuantity || 0) > 0) && !this.isFullyDelivered;
});

// Pre-save middleware to generate order number and calculate totals
SaleOrderSchema.pre('save', async function(next) {
  if (this.isNew && !this.orderNumber) {
    const count = await mongoose.model('SaleOrder').countDocuments();
    this.orderNumber = `SO${String(count + 1).padStart(6, '0')}`;
  }
  
  // Update pending quantities for items
  this.items.forEach(item => {
    item.pendingQuantity = item.quantity - item.deliveredQuantity;
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

// Pre-save middleware to update status based on inventory availability
SaleOrderSchema.pre('save', async function(next) {
  // Only check inventory if the order is being confirmed for the first time
  if (this.isModified('status') && this.status === 'confirmed') {
    try {
      // Check if any items have insufficient stock
      const Product = mongoose.model('Product');
      let hasBackorders = false;
      
      for (const item of this.items) {
        const product = await Product.findById(item.product);
        if (!product) {
          throw new Error(`Product not found: ${item.product}`);
        }
        
        if (product.quantity < item.quantity) {
          hasBackorders = true;
          const availableQty = Math.max(0, product.quantity);
          item.backorderedQuantity = item.quantity - availableQty;
          item.deliveredQuantity = availableQty;
        }
      }
      
      if (hasBackorders) {
        this.status = 'backordered';
      }
    } catch (error) {
      next(error);
      return;
    }
  }
  next();
});

// Post-save middleware to check if backorder can be fulfilled when inventory is updated
SaleOrderSchema.post('save', async function(doc) {
  if (doc.status === 'backordered') {
    const Product = mongoose.model('Product');
    let allBackordersFulfilled = true;
    
    // Check each backordered item
    for (const item of doc.items) {
      if (item.backorderedQuantity > 0) {
        const product = await Product.findById(item.product);
        
        if (product.quantity >= item.backorderedQuantity) {
          // Fulfill backorder
          const fulfillQty = item.backorderedQuantity;
          
          try {
            // Use reserveStock to handle the fulfillment
            await reserveStock(
              doc._id,
              [{
                product: item.product,
                quantity: fulfillQty
              }],
              doc.warehouse,
              doc.createdBy
            );
            
            // Update item quantities
            item.deliveredQuantity += fulfillQty;
            item.backorderedQuantity = 0;
            item.pendingQuantity = item.quantity - item.deliveredQuantity;
          } catch (error) {
            console.error('Error fulfilling backorder:', error);
            allBackordersFulfilled = false;
          }
        } else {
          allBackordersFulfilled = false;
        }
      }
    }
    
    // Update order status if all backorders are fulfilled
    if (allBackordersFulfilled) {
      doc.status = 'processing';
      await doc.save();
    }
  }
});

module.exports = mongoose.model('SaleOrder', SaleOrderSchema); 