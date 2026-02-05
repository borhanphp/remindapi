const mongoose = require('mongoose');

const StockTransferSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: false // Optional for backward compatibility
    },
    reference: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    sourceWarehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true
    },
    destinationWarehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'in_transit', 'completed', 'cancelled'],
      default: 'pending'
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: ['pending', 'in_transit', 'completed', 'cancelled'],
          required: true
        },
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        updatedAt: {
          type: Date,
          default: Date.now
        },
        notes: String
      }
    ],
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true
        },
        quantity: {
          type: Number,
          required: true,
          min: [1, 'Quantity must be at least 1']
        }
      }
    ],
    shippingDetails: {
      trackingNumber: String,
      carrier: String,
      estimatedDelivery: Date,
      actualDelivery: Date
    },
    note: {
      type: String,
      maxlength: [500, 'Note cannot be more than 500 characters']
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    completedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

// Method to update status with history tracking
StockTransferSchema.methods.updateStatus = function(newStatus, userId, notes = '') {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    updatedBy: userId,
    updatedAt: new Date(),
    notes
  });
  
  if (newStatus === 'completed') {
    this.completedBy = userId;
    this.completedAt = new Date();
  }
  
  return this.save();
};

// Generate reference number before saving
StockTransferSchema.pre('save', async function(next) {
  // Only generate reference if it's a new document
  if (this.isNew && !this.reference) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await mongoose.model('StockTransfer').countDocuments();
    this.reference = `TRANS-${date}-${count + 1}`;
  }
  next();
});

module.exports = mongoose.model('StockTransfer', StockTransferSchema); 