const mongoose = require('mongoose');

const StockAdjustmentSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: false // Optional for backward compatibility
    },
    reference: {
      type: String,
      unique: true,
      trim: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    adjustmentType: {
      type: String,
      required: true,
      enum: ['opening_stock', 'stock_count', 'damaged', 'returned', 'expired', 'lost', 'other']
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true
    },
    note: {
      type: String,
      maxlength: [500, 'Note cannot be more than 500 characters']
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true
        },
        quantity: {
          type: Number,
          required: true
        },
        cost: {
          type: Number,
          min: 0
        }
      }
    ],
    totalCost: {
      type: Number,
      default: 0
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

// Static method to generate unique reference number
StockAdjustmentSchema.statics.generateReference = async function (adjustmentType, organizationId) {
  const maxRetries = 10;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const currentDay = String(now.getDate()).padStart(2, '0');
      const timestamp = now.getTime();

      // Use timestamp for uniqueness to avoid race conditions
      const prefix = `ADJ-${currentYear}${currentMonth}${currentDay}`;
      const reference = `${prefix}-${timestamp.toString().slice(-6)}`;

      // Check if this reference already exists
      const existing = await this.findOne({ reference });
      if (!existing) {
        return reference;
      }

      // If exists, add a random suffix
      const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const uniqueRef = `${prefix}-${timestamp.toString().slice(-6)}-${randomSuffix}`;

      return uniqueRef;
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  throw new Error('Failed to generate unique reference number after multiple attempts');
};

// Generate reference number before validation
StockAdjustmentSchema.pre('validate', async function (next) {
  try {
    if (this.isNew && !this.reference) {
      this.reference = await this.constructor.generateReference(this.adjustmentType);
    }
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('StockAdjustment', StockAdjustmentSchema); 