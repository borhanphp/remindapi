const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  plan: {
    type: String,
    enum: ['free', 'pro'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'trial', 'expired', 'cancelled', 'past_due', 'paused'],
    required: true
  },
  currentPeriodStart: {
    type: Date,
    required: true
  },
  currentPeriodEnd: {
    type: Date,
    required: true
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },
  // Paddle fields
  paddleCustomerId: {
    type: String,
    sparse: true
  },
  paddleSubscriptionId: {
    type: String,
    sparse: true
  },
  paddlePriceId: {
    type: String
  },
  paddleTransactionId: {
    type: String
  },
  // Billing details from Paddle
  billingCycle: {
    interval: {
      type: String,
      enum: ['month', 'year'],
      default: 'month'
    },
    frequency: {
      type: Number,
      default: 1
    }
  },
  nextBilledAt: {
    type: Date
  },
  quantity: {
    type: Number,
    default: 1
  },
  // Payment details
  currency: {
    type: String,
    default: 'USD'
  },
  unitPrice: {
    type: Number
  },
  // Cancellation details
  cancelledAt: {
    type: Date
  },
  cancellationReason: {
    type: String
  },
  metadata: {
    type: Map,
    of: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Subscription plans configuration
subscriptionSchema.statics.plans = {
  free: {
    name: 'Free',
    price: 0,
    interval: 'month',
    features: {
      maxInvoices: 5,
      emailReminders: true,
      basicReporting: true,
      automatedSchedule: false,
      prioritySupport: false,
      removeBranding: false
    }
  },
  pro: {
    name: 'Pro',
    price: 9,
    interval: 'month',
    features: {
      maxInvoices: -1, // unlimited
      emailReminders: true,
      basicReporting: true,
      automatedSchedule: true,
      prioritySupport: true,
      removeBranding: true
    }
  }
};

// Index for faster queries
subscriptionSchema.index({ organization: 1 });
subscriptionSchema.index({ paddleSubscriptionId: 1 });
subscriptionSchema.index({ paddleCustomerId: 1 });
subscriptionSchema.index({ status: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema); 