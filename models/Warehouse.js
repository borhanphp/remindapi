const mongoose = require('mongoose');

const WarehouseSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: false // Temporarily optional during migration
    },
    name: {
      type: String,
      required: [true, 'Warehouse name is required'],
      trim: true,
      maxlength: [100, 'Warehouse name cannot be more than 100 characters']
    },
    code: {
      type: String,
      required: [true, 'Warehouse code is required'],
      unique: true,
      trim: true,
      maxlength: [20, 'Warehouse code cannot be more than 20 characters']
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    },
    contactPerson: {
      name: String,
      email: String,
      phone: String
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot be more than 500 characters']
    },
    // Warehouse capacity
    totalCapacity: {
      maxWeight: {
        type: Number,
        min: 0
      },
      maxVolume: {
        type: Number,
        min: 0
      },
      weightUnit: {
        type: String,
        enum: ['kg', 'lb'],
        default: 'kg'
      },
      volumeUnit: {
        type: String,
        enum: ['m3', 'ft3'],
        default: 'm3'
      }
    },
    // Warehouse zones
    zones: [{
      zoneCode: {
        type: String,
        trim: true,
        uppercase: true
      },
      zoneName: String,
      zoneType: {
        type: String,
        enum: ['receiving', 'storage', 'picking', 'packing', 'shipping', 'returns', 'quarantine']
      }
    }],
    // Location tracking enabled
    useLocationTracking: {
      type: Boolean,
      default: false
    },
    // Temperature controlled
    temperatureControlled: {
      type: Boolean,
      default: false
    },
    temperatureRange: {
      min: Number,
      max: Number,
      unit: {
        type: String,
        enum: ['C', 'F'],
        default: 'C'
      }
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for location count
WarehouseSchema.virtual('locationCount', {
  ref: 'WarehouseLocation',
  localField: '_id',
  foreignField: 'warehouse',
  count: true
});

module.exports = mongoose.model('Warehouse', WarehouseSchema); 