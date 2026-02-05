const mongoose = require('mongoose');

const PickingTaskSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    taskNumber: {
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
    pickingType: {
      type: String,
      enum: ['single_order', 'batch', 'wave', 'zone', 'cluster'],
      default: 'single_order',
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
      index: true
    },
    priority: {
      type: Number,
      default: 5,
      min: 1,
      max: 10
    },
    // Orders to pick
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
    // Picking items
    items: [{
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SaleOrder'
      },
      quantityRequired: {
        type: Number,
        required: true,
        min: 0
      },
      quantityPicked: {
        type: Number,
        default: 0,
        min: 0
      },
      // Location to pick from
      fromLocation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WarehouseLocation'
      },
      locationPath: String, // Cached location path for easy display
      // Batch/Serial selection
      batchSerial: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BatchSerial'
      },
      batchNumber: String,
      serialNumber: String,
      // Picking status
      itemStatus: {
        type: String,
        enum: ['pending', 'picking', 'picked', 'short_picked', 'skipped'],
        default: 'pending'
      },
      shortageReason: String,
      pickedAt: Date,
      pickedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      notes: String
    }],
    // Assignment
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    assignedAt: Date,
    // Timing
    startedAt: Date,
    completedAt: Date,
    estimatedDuration: {
      type: Number, // in minutes
      default: 30
    },
    actualDuration: Number, // in minutes
    // Wave picking
    waveNumber: String,
    // Zone picking
    zone: String,
    // Packing location (where picked items go)
    packingLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WarehouseLocation'
    },
    // Summary
    summary: {
      totalItems: {
        type: Number,
        default: 0
      },
      itemsPicked: {
        type: Number,
        default: 0
      },
      itemsShortPicked: {
        type: Number,
        default: 0
      },
      completionPercentage: {
        type: Number,
        default: 0
      }
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
PickingTaskSchema.index({ organization: 1, warehouse: 1, status: 1 });
PickingTaskSchema.index({ assignedTo: 1, status: 1 });
PickingTaskSchema.index({ 'orders.order': 1 });
PickingTaskSchema.index({ createdAt: -1 });

// Static method to generate task number
PickingTaskSchema.statics.generateTaskNumber = async function () {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  const sequenceRegex = new RegExp(`^PICK-${year}${month}${day}-(\\d{5})$`);

  const latestTask = await this.findOne({
    taskNumber: sequenceRegex
  }).sort({ taskNumber: -1 });

  let nextSequence = 1;

  if (latestTask && latestTask.taskNumber) {
    const match = latestTask.taskNumber.match(sequenceRegex);
    if (match && match[1]) {
      nextSequence = parseInt(match[1], 10) + 1;
    }
  }

  const sequence = String(nextSequence).padStart(5, '0');
  return `PICK-${year}${month}${day}-${sequence}`;
};

// Method to calculate summary
PickingTaskSchema.methods.calculateSummary = function () {
  this.summary.totalItems = this.items.length;
  this.summary.itemsPicked = this.items.filter(item =>
    item.itemStatus === 'picked' || item.itemStatus === 'short_picked'
  ).length;
  this.summary.itemsShortPicked = this.items.filter(item =>
    item.itemStatus === 'short_picked'
  ).length;

  if (this.summary.totalItems > 0) {
    this.summary.completionPercentage = (this.summary.itemsPicked / this.summary.totalItems) * 100;
  }

  return this.summary;
};

// Method to start picking
PickingTaskSchema.methods.start = function (userId) {
  if (this.status !== 'assigned' && this.status !== 'pending') {
    throw new Error('Task must be pending or assigned to start');
  }

  this.status = 'in_progress';
  this.startedAt = new Date();

  if (!this.assignedTo) {
    this.assignedTo = userId;
    this.assignedAt = new Date();
  }

  return this.save();
};

// Method to pick an item
PickingTaskSchema.methods.pickItem = function (itemId, quantityPicked, options = {}) {
  const item = this.items.id(itemId);

  if (!item) {
    throw new Error('Item not found in picking task');
  }

  if (item.itemStatus === 'picked') {
    throw new Error('Item already picked');
  }

  item.quantityPicked = quantityPicked;
  item.pickedAt = new Date();
  item.pickedBy = options.pickedBy;

  if (options.batchSerial) item.batchSerial = options.batchSerial;
  if (options.batchNumber) item.batchNumber = options.batchNumber;
  if (options.serialNumber) item.serialNumber = options.serialNumber;
  if (options.notes) item.notes = options.notes;

  // Check if short picked
  if (quantityPicked < item.quantityRequired) {
    item.itemStatus = 'short_picked';
    if (options.shortageReason) item.shortageReason = options.shortageReason;
  } else {
    item.itemStatus = 'picked';
  }

  this.calculateSummary();

  return this.save();
};

// Method to complete task
PickingTaskSchema.methods.complete = function () {
  // Check if all items are picked or short-picked
  const unpickedItems = this.items.filter(item =>
    item.itemStatus === 'pending' || item.itemStatus === 'picking'
  );

  if (unpickedItems.length > 0) {
    throw new Error(`${unpickedItems.length} items still need to be picked`);
  }

  this.status = 'completed';
  this.completedAt = new Date();

  if (this.startedAt) {
    const durationMs = this.completedAt - this.startedAt;
    this.actualDuration = Math.round(durationMs / 1000 / 60); // Convert to minutes
  }

  return this.save();
};

// Pre-save middleware to generate task number
PickingTaskSchema.pre('save', async function (next) {
  if (this.isNew && !this.taskNumber) {
    this.taskNumber = await this.constructor.generateTaskNumber();
  }
  next();
});

// Pre-save middleware to calculate summary
PickingTaskSchema.pre('save', function (next) {
  this.calculateSummary();
  next();
});

module.exports = mongoose.model('PickingTask', PickingTaskSchema);

