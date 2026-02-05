const mongoose = require('mongoose');

const POSSessionSchema = new mongoose.Schema(
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
    cashier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    sessionNumber: {
      type: String,
      required: true,
      unique: true
    },
    startTime: {
      type: Date,
      required: true,
      default: Date.now
    },
    endTime: {
      type: Date
    },
    openingCash: {
      type: Number,
      required: true,
      min: [0, 'Opening cash cannot be negative'],
      default: 0
    },
    closingCash: {
      type: Number,
      min: [0, 'Closing cash cannot be negative']
    },
    expectedCash: {
      type: Number,
      min: [0, 'Expected cash cannot be negative']
    },
    actualCash: {
      type: Number,
      min: [0, 'Actual cash cannot be negative']
    },
    difference: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['active', 'closed'],
      default: 'active'
    },
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot be more than 500 characters']
    },
    transactions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'POSTransaction'
    }],
    // Summary fields
    totalSales: {
      type: Number,
      default: 0,
      min: 0
    },
    totalTransactions: {
      type: Number,
      default: 0,
      min: 0
    },
    cashSales: {
      type: Number,
      default: 0,
      min: 0
    },
    cardSales: {
      type: Number,
      default: 0,
      min: 0
    },
    gatewaySales: {
      type: Number,
      default: 0,
      min: 0
    },
    refunds: {
      type: Number,
      default: 0,
      min: 0
    },
    voids: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

// Indexes
POSSessionSchema.index({ organization: 1, warehouse: 1, status: 1 });
POSSessionSchema.index({ cashier: 1, startTime: -1 });
POSSessionSchema.index({ sessionNumber: 1 });

// Pre-save middleware to calculate difference
POSSessionSchema.pre('save', function(next) {
  if (this.status === 'closed' && this.expectedCash !== undefined && this.actualCash !== undefined) {
    this.difference = this.actualCash - this.expectedCash;
  }
  next();
});

// Method to generate session number
POSSessionSchema.statics.generateSessionNumber = async function(organizationId, warehouseId) {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
  
  const count = await this.countDocuments({
    organization: organizationId,
    warehouse: warehouseId,
    startTime: {
      $gte: new Date(today.setHours(0, 0, 0, 0)),
      $lt: new Date(today.setHours(23, 59, 59, 999))
    }
  });
  
  return `POS-${dateStr}-${String(count + 1).padStart(4, '0')}`;
};

module.exports = mongoose.model('POSSession', POSSessionSchema);

