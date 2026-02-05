const mongoose = require('mongoose');

const CycleCountSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    countNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true
    },
    countType: {
      type: String,
      enum: ['cycle', 'full', 'spot', 'abc'],
      default: 'cycle',
      required: true
    },
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'completed', 'cancelled', 'approved', 'rejected'],
      default: 'scheduled',
      index: true
    },
    scheduledDate: {
      type: Date,
      required: true,
      index: true
    },
    startedDate: {
      type: Date
    },
    completedDate: {
      type: Date
    },
    // Count items
    items: [{
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      location: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WarehouseLocation'
      },
      // System quantity (expected)
      systemQuantity: {
        type: Number,
        required: true,
        default: 0
      },
      // First count
      countedQuantity: {
        type: Number,
        default: null
      },
      countedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      countedAt: {
        type: Date
      },
      // Second count (for discrepancies)
      recountQuantity: {
        type: Number,
        default: null
      },
      recountedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      recountedAt: {
        type: Date
      },
      // Batch/Serial info
      batchSerial: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BatchSerial'
      },
      // Variance
      variance: {
        type: Number,
        default: 0
      },
      varianceValue: {
        type: Number,
        default: 0
      },
      variancePercentage: {
        type: Number,
        default: 0
      },
      // Status
      itemStatus: {
        type: String,
        enum: ['pending', 'counted', 'recount_required', 'approved', 'adjusted'],
        default: 'pending'
      },
      notes: String,
      // Photo evidence
      photos: [{
        url: String,
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        uploadedAt: {
          type: Date,
          default: Date.now
        }
      }]
    }],
    // Assignment
    assignedTo: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    // Variance thresholds
    varianceThreshold: {
      quantityThreshold: {
        type: Number,
        default: 0
      },
      percentageThreshold: {
        type: Number,
        default: 5
      },
      valueThreshold: {
        type: Number,
        default: 100
      }
    },
    // Blind count (hide system quantity from counters)
    blindCount: {
      type: Boolean,
      default: false
    },
    // ABC classification filter
    abcClass: {
      type: String,
      enum: ['A', 'B', 'C', 'all'],
      default: 'all'
    },
    // Summary
    summary: {
      totalItems: {
        type: Number,
        default: 0
      },
      itemsCounted: {
        type: Number,
        default: 0
      },
      itemsWithVariance: {
        type: Number,
        default: 0
      },
      totalVarianceValue: {
        type: Number,
        default: 0
      },
      accuracyPercentage: {
        type: Number,
        default: 0
      }
    },
    // Approval
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
    rejectionReason: String,
    // Stock adjustment created
    stockAdjustment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockAdjustment'
    },
    notes: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
CycleCountSchema.index({ organization: 1, warehouse: 1, status: 1 });
CycleCountSchema.index({ organization: 1, scheduledDate: 1 });
CycleCountSchema.index({ 'items.product': 1 });

// Static method to generate count number
CycleCountSchema.statics.generateCountNumber = async function() {
  const count = await this.countDocuments();
  const year = new Date().getFullYear();
  const sequence = String(count + 1).padStart(5, '0');
  return `CC-${year}-${sequence}`;
};

// Method to calculate item variance
CycleCountSchema.methods.calculateItemVariance = function(itemIndex) {
  const item = this.items[itemIndex];
  
  // Use recount quantity if available, otherwise counted quantity
  const actualQuantity = item.recountQuantity !== null ? item.recountQuantity : item.countedQuantity;
  
  if (actualQuantity === null) {
    return item;
  }
  
  item.variance = actualQuantity - item.systemQuantity;
  
  // Get product cost for value calculation (simplified - should get actual cost)
  item.varianceValue = item.variance * (item.product.costPrice || 0);
  
  if (item.systemQuantity > 0) {
    item.variancePercentage = (item.variance / item.systemQuantity) * 100;
  }
  
  // Check if recount is required
  const exceedsThreshold = 
    Math.abs(item.variance) > this.varianceThreshold.quantityThreshold ||
    Math.abs(item.variancePercentage) > this.varianceThreshold.percentageThreshold ||
    Math.abs(item.varianceValue) > this.varianceThreshold.valueThreshold;
  
  if (exceedsThreshold && item.recountQuantity === null) {
    item.itemStatus = 'recount_required';
  } else {
    item.itemStatus = item.variance === 0 ? 'approved' : 'counted';
  }
  
  return item;
};

// Method to calculate summary
CycleCountSchema.methods.calculateSummary = function() {
  this.summary.totalItems = this.items.length;
  this.summary.itemsCounted = this.items.filter(item => 
    item.countedQuantity !== null || item.recountQuantity !== null
  ).length;
  
  let itemsWithVariance = 0;
  let totalVarianceValue = 0;
  let accurateItems = 0;
  
  this.items.forEach(item => {
    const actualQuantity = item.recountQuantity !== null ? item.recountQuantity : item.countedQuantity;
    
    if (actualQuantity !== null) {
      const variance = actualQuantity - item.systemQuantity;
      
      if (variance !== 0) {
        itemsWithVariance++;
        totalVarianceValue += Math.abs(item.varianceValue || 0);
      } else {
        accurateItems++;
      }
    }
  });
  
  this.summary.itemsWithVariance = itemsWithVariance;
  this.summary.totalVarianceValue = totalVarianceValue;
  
  if (this.summary.itemsCounted > 0) {
    this.summary.accuracyPercentage = (accurateItems / this.summary.itemsCounted) * 100;
  }
  
  return this.summary;
};

// Pre-save middleware to generate count number
CycleCountSchema.pre('save', async function(next) {
  if (this.isNew && !this.countNumber) {
    this.countNumber = await this.constructor.generateCountNumber();
  }
  next();
});

// Pre-save middleware to calculate summary
CycleCountSchema.pre('save', function(next) {
  this.calculateSummary();
  next();
});

module.exports = mongoose.model('CycleCount', CycleCountSchema);

