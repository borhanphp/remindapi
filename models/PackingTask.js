const mongoose = require('mongoose');

const PackingTaskSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  packingNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  pickingTask: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PickingTask',
    required: true
  },
  warehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    required: true
  },
  orders: [{
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SaleOrder',
      required: true
    },
    orderNumber: String,
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer'
    }
  }],
  boxes: [{
    boxNumber: {
      type: String,
      required: true
    },
    weight: {
      type: Number,
      min: 0
    },
    weightUnit: {
      type: String,
      enum: ['kg', 'lb', 'g'],
      default: 'kg'
    },
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
      unit: {
        type: String,
        enum: ['cm', 'in', 'm'],
        default: 'cm'
      }
    },
    items: [{
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      quantity: {
        type: Number,
        required: true,
        min: 1
      }
    }],
    trackingNumber: String,
    carrier: {
      type: String,
      enum: ['fedex', 'ups', 'dhl', 'usps', 'other'],
      default: 'other'
    },
    carrierService: String,
    shippingLabel: {
      url: String,
      generatedAt: Date
    }
  }],
  status: {
    type: String,
    enum: ['pending', 'packing', 'packed', 'shipped', 'cancelled'],
    default: 'pending',
    index: true
  },
  packedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  packedAt: Date,
  shippedAt: Date,
  shippedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
PackingTaskSchema.index({ organization: 1, warehouse: 1, status: 1 });
PackingTaskSchema.index({ pickingTask: 1 });
PackingTaskSchema.index({ createdAt: -1 });

// Static method to generate packing number
PackingTaskSchema.statics.generatePackingNumber = async function() {
  const count = await this.countDocuments();
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const sequence = String(count + 1).padStart(5, '0');
  return `PACK-${year}${month}${day}-${sequence}`;
};

// Pre-save middleware to generate packing number
PackingTaskSchema.pre('save', async function(next) {
  if (this.isNew && !this.packingNumber) {
    this.packingNumber = await this.constructor.generatePackingNumber();
  }
  next();
});

module.exports = mongoose.model('PackingTask', PackingTaskSchema);

