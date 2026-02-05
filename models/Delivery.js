const mongoose = require('mongoose');

const DeliverySchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: false
    },
    deliveryNumber: {
      type: String,
      unique: true,
      required: true
    },
    saleOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SaleOrder',
      required: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true
    },
    shippingMethod: {
      type: String,
      required: true,
      enum: ['pickup', 'local-delivery', 'courier', 'freight']
    },
    shippingCarrier: {
      type: String,
      trim: true
    },
    trackingNumber: {
      type: String,
      trim: true
    },
    scheduledDate: {
      type: Date,
      required: true
    },
    actualDeliveryDate: {
      type: Date
    },
    status: {
      type: String,
      enum: ['pending', 'picked', 'packed', 'shipped', 'in-transit', 'delivered', 'failed', 'cancelled'],
      default: 'pending'
    },
    statusHistory: [{
      status: {
        type: String,
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      note: String,
      location: String,
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      }
    }],
    items: [{
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      quantity: {
        type: Number,
        required: true,
        min: [1, 'Quantity must be at least 1']
      },
      packageNumbers: [String], // For multiple packages per item
      notes: String
    }],
    packages: [{
      packageNumber: {
        type: String,
        required: true
      },
      weight: {
        value: Number,
        unit: {
          type: String,
          enum: ['kg', 'lb'],
          default: 'kg'
        }
      },
      dimensions: {
        length: Number,
        width: Number,
        height: Number,
        unit: {
          type: String,
          enum: ['cm', 'in'],
          default: 'cm'
        }
      },
      items: [{
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product'
        },
        quantity: Number
      }]
    }],
    shippingAddress: {
      street: {
        type: String,
        required: true
      },
      city: {
        type: String,
        required: true
      },
      state: {
        type: String,
        required: true
      },
      postalCode: {
        type: String,
        required: true
      },
      country: {
        type: String,
        required: true
      },
      contactName: String,
      contactPhone: String
    },
    specialInstructions: String,
    attachments: [{
      type: {
        type: String,
        enum: ['challan', 'packing-slip', 'pod', 'other'],
        required: true
      },
      filename: String,
      originalName: String,
      path: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      },
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

// Pre-save middleware to generate delivery number
DeliverySchema.pre('save', async function(next) {
  if (this.isNew && !this.deliveryNumber) {
    const count = await this.constructor.countDocuments();
    this.deliveryNumber = `DEL${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Add method to update status with history
DeliverySchema.methods.updateStatus = async function(newStatus, note, location, userId) {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    note,
    location,
    updatedBy: userId,
    timestamp: new Date()
  });
  
  if (newStatus === 'delivered') {
    this.actualDeliveryDate = new Date();
  }
  
  await this.save();
};

module.exports = mongoose.model('Delivery', DeliverySchema); 