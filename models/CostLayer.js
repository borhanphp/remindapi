const mongoose = require('mongoose');

/**
 * Cost Layer Model - Tracks inventory cost layers for FIFO/LIFO costing
 * Each layer represents a batch of inventory received at a specific cost
 */
const CostLayerSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  warehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    required: true,
    index: true
  },
  // Cost information
  unitCost: {
    type: Number,
    required: true,
    min: 0
  },
  // Quantity tracking
  originalQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  remainingQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  // Receipt information
  receivedDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  // Reference to the transaction that created this layer
  sourceTransaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryTransaction'
  },
  // Reference document (purchase order, stock adjustment, etc.)
  referenceType: {
    type: String,
    enum: ['purchase_order', 'stock_adjustment', 'return', 'transfer'],
    required: true
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  // Status
  status: {
    type: String,
    enum: ['active', 'consumed', 'expired'],
    default: 'active',
    index: true
  },
  // Batch/Serial reference (if applicable)
  batchSerial: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BatchSerial'
  },
  // For tracking which transactions consumed from this layer
  consumedBy: [{
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryTransaction'
    },
    quantity: Number,
    date: Date
  }]
}, {
  timestamps: true
});

// Compound indexes for efficient queries
CostLayerSchema.index({ organization: 1, product: 1, warehouse: 1, status: 1 });
CostLayerSchema.index({ organization: 1, product: 1, warehouse: 1, receivedDate: 1 }); // For FIFO
CostLayerSchema.index({ organization: 1, product: 1, warehouse: 1, receivedDate: -1 }); // For LIFO

// Static method to get active layers for FIFO
CostLayerSchema.statics.getActiveLayersFIFO = async function(productId, warehouseId, organizationId) {
  return this.find({
    organization: organizationId,
    product: productId,
    warehouse: warehouseId,
    status: 'active',
    remainingQuantity: { $gt: 0 }
  }).sort({ receivedDate: 1 }); // Oldest first
};

// Static method to get active layers for LIFO
CostLayerSchema.statics.getActiveLayersLIFO = async function(productId, warehouseId, organizationId) {
  return this.find({
    organization: organizationId,
    product: productId,
    warehouse: warehouseId,
    status: 'active',
    remainingQuantity: { $gt: 0 }
  }).sort({ receivedDate: -1 }); // Newest first
};

// Instance method to consume quantity from layer
CostLayerSchema.methods.consume = async function(quantity, transactionId) {
  if (quantity > this.remainingQuantity) {
    throw new Error(`Cannot consume ${quantity} units. Only ${this.remainingQuantity} remaining.`);
  }
  
  this.remainingQuantity -= quantity;
  
  if (this.remainingQuantity === 0) {
    this.status = 'consumed';
  }
  
  this.consumedBy.push({
    transaction: transactionId,
    quantity,
    date: new Date()
  });
  
  return this.save();
};

// Static method to calculate weighted average cost
CostLayerSchema.statics.calculateWeightedAverage = async function(productId, warehouseId, organizationId) {
  const layers = await this.find({
    organization: organizationId,
    product: productId,
    warehouse: warehouseId,
    status: 'active',
    remainingQuantity: { $gt: 0 }
  });
  
  if (layers.length === 0) {
    return 0;
  }
  
  const totalValue = layers.reduce((sum, layer) => sum + (layer.unitCost * layer.remainingQuantity), 0);
  const totalQuantity = layers.reduce((sum, layer) => sum + layer.remainingQuantity, 0);
  
  return totalQuantity > 0 ? totalValue / totalQuantity : 0;
};

module.exports = mongoose.model('CostLayer', CostLayerSchema);

