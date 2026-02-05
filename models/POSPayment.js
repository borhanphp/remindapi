const mongoose = require('mongoose');

const POSPaymentSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true
    },
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'POSTransaction',
      required: true
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'gateway', 'other'],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Amount cannot be negative']
    },
    // For cash payments
    receivedAmount: {
      type: Number,
      min: [0, 'Received amount cannot be negative']
    },
    change: {
      type: Number,
      default: 0,
      min: [0, 'Change cannot be negative']
    },
    // For gateway payments
    gateway: {
      type: String,
      enum: ['stripe', 'square', 'paypal', 'other']
    },
    gatewayTransactionId: {
      type: String
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed
    },
    // For card payments (manual entry)
    cardType: {
      type: String,
      enum: ['visa', 'mastercard', 'amex', 'discover', 'other']
    },
    cardLast4: {
      type: String,
      maxlength: 4
    },
    cardHolderName: {
      type: String
    },
    receiptNumber: {
      type: String
    },
    status: {
      type: String,
      enum: ['completed', 'refunded', 'failed', 'pending'],
      default: 'completed'
    },
    refundedAmount: {
      type: Number,
      default: 0,
      min: [0, 'Refunded amount cannot be negative']
    },
    refundedAt: {
      type: Date
    },
    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    refundReason: {
      type: String,
      maxlength: [500, 'Refund reason cannot be more than 500 characters']
    },
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot be more than 500 characters']
    }
  },
  {
    timestamps: true
  }
);

// Indexes
POSPaymentSchema.index({ organization: 1, createdAt: -1 });
POSPaymentSchema.index({ transaction: 1 });
POSPaymentSchema.index({ paymentMethod: 1, status: 1 });
POSPaymentSchema.index({ gatewayTransactionId: 1 });

// Pre-save middleware to calculate change for cash payments
POSPaymentSchema.pre('save', function(next) {
  if (this.paymentMethod === 'cash' && this.receivedAmount !== undefined && this.amount !== undefined) {
    this.change = Math.max(0, this.receivedAmount - this.amount);
  }
  next();
});

module.exports = mongoose.model('POSPayment', POSPaymentSchema);

