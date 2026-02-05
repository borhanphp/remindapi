const mongoose = require('mongoose');

const InventoryTransactionSchema = new mongoose.Schema({
  transactionType: {
    type: String,
    enum: ['sale', 'purchase', 'return', 'adjustment', 'transfer', 'backorder'],
    required: true
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
  quantity: {
    type: Number,
    required: true
  },
  previousQuantity: {
    type: Number,
    required: true
  },
  newQuantity: {
    type: Number,
    required: true
  },
  reference: {
    type: {
      type: String,
      enum: ['sale_order', 'purchase_order', 'return', 'adjustment', 'transfer', 'backorder'],
      required: true
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    }
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled', 'backordered'],
    default: 'pending'
  },
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Cost Tracking
  unitCost: {
    type: Number,
    min: 0,
    default: 0
  },
  totalCost: {
    type: Number,
    min: 0,
    default: 0
  },
  // For cost layer tracking (FIFO/LIFO)
  costLayers: [{
    layer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CostLayer'
    },
    quantity: Number,
    unitCost: Number
  }],
  // Valuation method used at time of transaction
  valuationMethod: {
    type: String,
    enum: ['fifo', 'lifo', 'weighted_average', 'standard']
  },
  // Running average cost (for weighted average method)
  averageCost: {
    type: Number,
    min: 0
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
InventoryTransactionSchema.index({ product: 1, warehouse: 1 });
InventoryTransactionSchema.index({ transactionType: 1, status: 1 });
InventoryTransactionSchema.index({ reference: 1 });

module.exports = mongoose.model('InventoryTransaction', InventoryTransactionSchema); 