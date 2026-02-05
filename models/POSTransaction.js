const mongoose = require('mongoose');

const POSTransactionSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true
    },
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'POSSession',
      required: true
    },
    cashier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    transactionNumber: {
      type: String,
      required: true,
      unique: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer'
    },
    items: [{
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      },
      variant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductVariant'
      },
      productName: {
        type: String,
        required: true
      },
      productSku: {
        type: String
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
      discount: {
        type: Number,
        default: 0,
        min: [0, 'Discount cannot be negative']
      },
      discountType: {
        type: String,
        enum: ['percentage', 'fixed'],
        default: 'fixed'
      },
      total: {
        type: Number,
        default: 0,
        min: [0, 'Total cannot be negative']
      },
      notes: {
        type: String,
        maxlength: [200, 'Item notes cannot be more than 200 characters']
      }
    }],
    subtotal: {
      type: Number,
      default: 0,
      min: [0, 'Subtotal cannot be negative']
    },
    tax: {
      rate: {
        type: Number,
        default: 0,
        min: [0, 'Tax rate cannot be negative']
      },
      amount: {
        type: Number,
        default: 0,
        min: [0, 'Tax amount cannot be negative']
      }
    },
    discount: {
      type: {
        type: String,
        enum: ['percentage', 'fixed'],
        default: 'fixed'
      },
      value: {
        type: Number,
        default: 0,
        min: [0, 'Discount value cannot be negative']
      },
      amount: {
        type: Number,
        default: 0,
        min: [0, 'Discount amount cannot be negative']
      }
    },
    total: {
      type: Number,
      default: 0,
      min: [0, 'Total cannot be negative']
    },
    payments: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'POSPayment'
    }],
    status: {
      type: String,
      enum: ['completed', 'void', 'returned', 'held'],
      default: 'completed'
    },
    voidReason: {
      type: String,
      maxlength: [500, 'Void reason cannot be more than 500 characters']
    },
    voidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    voidedAt: {
      type: Date
    },
    // Sync fields
    synced: {
      type: Boolean,
      default: false
    },
    syncTimestamp: {
      type: Date
    },
    syncError: {
      type: String
    },
    // Reference to sales order/invoice after sync
    salesOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SaleOrder'
    },
    saleInvoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SaleInvoice'
    },
    // Hold/resume fields
    heldAt: {
      type: Date
    },
    resumedAt: {
      type: Date
    },
    notes: {
      type: String,
      maxlength: [1000, 'Notes cannot be more than 1000 characters']
    }
  },
  {
    timestamps: true
  }
);

// Indexes
POSTransactionSchema.index({ organization: 1, warehouse: 1, createdAt: -1 });
POSTransactionSchema.index({ session: 1, createdAt: -1 });
POSTransactionSchema.index({ cashier: 1, createdAt: -1 });
POSTransactionSchema.index({ transactionNumber: 1 });
POSTransactionSchema.index({ customer: 1, createdAt: -1 });
POSTransactionSchema.index({ synced: 1, syncTimestamp: 1 });
POSTransactionSchema.index({ status: 1 });

// Method to generate transaction number
POSTransactionSchema.statics.generateTransactionNumber = async function(organizationId, warehouseId) {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
  
  // Find the last transaction for today to avoid race conditions
  const lastTransaction = await this.findOne({
    organization: organizationId,
    transactionNumber: { $regex: `^TXN-${dateStr}-` }
  })
  .sort({ transactionNumber: -1 })
  .select('transactionNumber')
  .lean();
  
  let nextNumber = 1;
  if (lastTransaction && lastTransaction.transactionNumber) {
    // Extract the number from the last transaction
    const match = lastTransaction.transactionNumber.match(/TXN-\d{8}-(\d{6})$/);
    if (match && match[1]) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }
  
  return `TXN-${dateStr}-${String(nextNumber).padStart(6, '0')}`;
};

// Pre-save middleware to calculate totals
POSTransactionSchema.pre('save', function(next) {
  // Calculate item totals
  this.items.forEach(item => {
    const itemSubtotal = item.quantity * item.unitPrice;
    let itemDiscount = 0;
    
    if (item.discountType === 'percentage') {
      itemDiscount = (itemSubtotal * item.discount) / 100;
    } else {
      itemDiscount = item.discount;
    }
    
    item.total = itemSubtotal - itemDiscount;
  });
  
  // Calculate subtotal
  this.subtotal = this.items.reduce((sum, item) => sum + item.total, 0);
  
  // Calculate discount
  let discountAmount = 0;
  if (this.discount.type === 'percentage') {
    discountAmount = (this.subtotal * this.discount.value) / 100;
  } else {
    discountAmount = this.discount.value;
  }
  this.discount.amount = discountAmount;
  
  // Calculate tax
  const taxableAmount = this.subtotal - discountAmount;
  this.tax.amount = (taxableAmount * this.tax.rate) / 100;
  
  // Calculate total
  this.total = this.subtotal - discountAmount + this.tax.amount;
  
  next();
});

module.exports = mongoose.model('POSTransaction', POSTransactionSchema);

