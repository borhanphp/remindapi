const mongoose = require('mongoose');

const StockAlertSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: false // Temporarily optional during migration
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true
    },
    currentQuantity: {
      type: Number,
      required: true
    },
    reorderLevel: {
      type: Number,
      required: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    status: {
      type: String,
      enum: ['new', 'acknowledged', 'resolved'],
      default: 'new'
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: ['new', 'acknowledged', 'resolved'],
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
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    acknowledgedAt: {
      type: Date
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: {
      type: Date
    },
    notificationSent: {
      type: Boolean,
      default: false
    },
    notificationMethod: {
      type: String,
      enum: ['email', 'system', 'both'],
      default: 'system'
    },
    notes: String
  },
  { timestamps: true }
);

// Calculate priority based on stock levels
StockAlertSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('currentQuantity') || this.isModified('reorderLevel')) {
    const stockPercentage = (this.currentQuantity / this.reorderLevel) * 100;
    
    if (stockPercentage <= 0) {
      this.priority = 'critical';
    } else if (stockPercentage <= 25) {
      this.priority = 'high';
    } else if (stockPercentage <= 50) {
      this.priority = 'medium';
    } else {
      this.priority = 'low';
    }
    
    // Add to status history if new
    if (this.isNew) {
      this.statusHistory = [{
        status: 'new',
        updatedAt: new Date(),
        notes: 'Alert created'
      }];
    }
  }
  next();
});

// Index for finding alerts by product and warehouse
StockAlertSchema.index({ product: 1, warehouse: 1 });

module.exports = mongoose.model('StockAlert', StockAlertSchema); 