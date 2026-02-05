const mongoose = require('mongoose');

const POSSyncQueueSchema = new mongoose.Schema(
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
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'POSTransaction',
      required: true
    },
    action: {
      type: String,
      enum: ['create', 'update', 'delete'],
      required: true
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'syncing', 'synced', 'failed'],
      default: 'pending'
    },
    retryCount: {
      type: Number,
      default: 0,
      min: [0, 'Retry count cannot be negative']
    },
    maxRetries: {
      type: Number,
      default: 5,
      min: [1, 'Max retries must be at least 1']
    },
    errorMessage: {
      type: String
    },
    errorDetails: {
      type: mongoose.Schema.Types.Mixed
    },
    syncedAt: {
      type: Date
    },
    syncedBy: {
      type: String // Device ID or user ID
    },
    // Conflict resolution
    hasConflict: {
      type: Boolean,
      default: false
    },
    conflictData: {
      type: mongoose.Schema.Types.Mixed
    },
    resolvedAt: {
      type: Date
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    priority: {
      type: Number,
      default: 0,
      min: [0, 'Priority cannot be negative']
    }
  },
  {
    timestamps: true
  }
);

// Indexes
POSSyncQueueSchema.index({ organization: 1, warehouse: 1, status: 1, priority: -1, createdAt: 1 });
POSSyncQueueSchema.index({ transaction: 1 });
POSSyncQueueSchema.index({ status: 1, retryCount: 1 });
POSSyncQueueSchema.index({ hasConflict: 1, status: 1 });

// Method to mark as syncing
POSSyncQueueSchema.methods.markAsSyncing = function() {
  this.status = 'syncing';
  return this.save();
};

// Method to mark as synced
POSSyncQueueSchema.methods.markAsSynced = function(syncedBy) {
  this.status = 'synced';
  this.syncedAt = new Date();
  this.syncedBy = syncedBy;
  return this.save();
};

// Method to mark as failed
POSSyncQueueSchema.methods.markAsFailed = function(errorMessage, errorDetails) {
  this.status = 'failed';
  this.errorMessage = errorMessage;
  this.errorDetails = errorDetails;
  this.retryCount += 1;
  return this.save();
};

// Method to check if can retry
POSSyncQueueSchema.methods.canRetry = function() {
  return this.retryCount < this.maxRetries;
};

module.exports = mongoose.model('POSSyncQueue', POSSyncQueueSchema);

