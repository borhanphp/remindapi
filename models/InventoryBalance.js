const mongoose = require('mongoose');

const inventoryBalanceSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    quantity: { type: Number, default: 0, min: 0 },
    
    // Weighted Average Cost tracking
    weightedAverageCost: {
      type: Number,
      default: 0,
      min: 0
    },
    totalValue: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Location-based inventory (for bin location tracking)
    locations: [{
      location: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WarehouseLocation'
      },
      quantity: {
        type: Number,
        default: 0,
        min: 0
      },
      // Optional batch/serial reference
      batchSerial: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BatchSerial'
      }
    }],
    
    // Batch/Serial Summary (for quick access without joining BatchSerial collection)
    batchSerialSummary: {
      trackingType: {
        type: String,
        enum: ['none', 'batch', 'serial']
      },
      totalBatches: {
        type: Number,
        default: 0
      },
      totalSerials: {
        type: Number,
        default: 0
      },
      nearExpiryCount: {
        type: Number,
        default: 0
      },
      expiredCount: {
        type: Number,
        default: 0
      },
      lastUpdated: Date
    },
    
    // Reserved quantity (for sales orders, etc.)
    reservedQuantity: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Available quantity (calculated)
    availableQuantity: {
      type: Number,
      default: function() {
        return this.quantity - this.reservedQuantity;
      }
    },
    
    // Last transaction info
    lastTransactionDate: {
      type: Date,
      default: Date.now
    },
    lastTransactionType: {
      type: String,
      enum: ['receipt', 'sale', 'adjustment', 'transfer_in', 'transfer_out', 'return', 'kit_deduction', 'kit_assembly']
    },
    
    updatedAt: { type: Date, default: Date.now }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

inventoryBalanceSchema.index({ organization: 1, product: 1, warehouse: 1 }, { unique: true });
inventoryBalanceSchema.index({ organization: 1, warehouse: 1 });
inventoryBalanceSchema.index({ lastTransactionDate: 1 });

// Virtual for days since last transaction
inventoryBalanceSchema.virtual('daysSinceLastTransaction').get(function() {
  if (!this.lastTransactionDate) return null;
  const now = new Date();
  const diffTime = now - this.lastTransactionDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Method to update weighted average cost
inventoryBalanceSchema.methods.updateWeightedAverageCost = function(incomingQty, incomingCost) {
  const currentValue = this.quantity * this.weightedAverageCost;
  const incomingValue = incomingQty * incomingCost;
  const newQuantity = this.quantity + incomingQty;
  
  if (newQuantity > 0) {
    this.weightedAverageCost = (currentValue + incomingValue) / newQuantity;
  }
  
  this.quantity = newQuantity;
  this.totalValue = this.quantity * this.weightedAverageCost;
  this.lastTransactionDate = new Date();
  
  return this.save();
};

// Method to reserve quantity
inventoryBalanceSchema.methods.reserve = function(quantity) {
  if (this.availableQuantity < quantity) {
    throw new Error('Insufficient available quantity to reserve');
  }
  this.reservedQuantity += quantity;
  return this.save();
};

// Method to unreserve quantity
inventoryBalanceSchema.methods.unreserve = function(quantity) {
  this.reservedQuantity = Math.max(0, this.reservedQuantity - quantity);
  return this.save();
};

// Method to update batch/serial summary
inventoryBalanceSchema.methods.updateBatchSerialSummary = async function() {
  const BatchSerial = mongoose.model('BatchSerial');
  
  const batches = await BatchSerial.find({
    organization: this.organization,
    product: this.product,
    warehouse: this.warehouse,
    type: 'batch',
    quantity: { $gt: 0 }
  });
  
  const serials = await BatchSerial.find({
    organization: this.organization,
    product: this.product,
    warehouse: this.warehouse,
    type: 'serial',
    status: 'available'
  });
  
  this.batchSerialSummary = {
    trackingType: batches.length > 0 ? 'batch' : (serials.length > 0 ? 'serial' : 'none'),
    totalBatches: batches.length,
    totalSerials: serials.length,
    nearExpiryCount: batches.filter(b => b.isExpiringSoon).length,
    expiredCount: batches.filter(b => b.isExpired).length,
    lastUpdated: new Date()
  };
  
  return this.save();
};

module.exports = mongoose.model('InventoryBalance', inventoryBalanceSchema);


