const mongoose = require('mongoose');

const WarehouseLocationSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true
    },
    locationCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    locationName: {
      type: String,
      trim: true
    },
    // Hierarchy: Zone -> Aisle -> Rack -> Shelf -> Bin
    zone: {
      type: String,
      trim: true,
      uppercase: true,
      index: true
    },
    aisle: {
      type: String,
      trim: true,
      uppercase: true
    },
    rack: {
      type: String,
      trim: true,
      uppercase: true
    },
    shelf: {
      type: String,
      trim: true,
      uppercase: true
    },
    bin: {
      type: String,
      trim: true,
      uppercase: true
    },
    // Location type
    locationType: {
      type: String,
      enum: ['receiving', 'reserve', 'picking', 'shipping', 'quarantine', 'damaged', 'returns', 'general'],
      default: 'general',
      index: true
    },
    // Capacity
    capacity: {
      maxWeight: {
        type: Number,
        min: 0
      },
      maxVolume: {
        type: Number,
        min: 0
      },
      maxUnits: {
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
    // Current utilization
    currentUtilization: {
      weight: {
        type: Number,
        default: 0,
        min: 0
      },
      volume: {
        type: Number,
        default: 0,
        min: 0
      },
      units: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    // Physical characteristics
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
      unit: {
        type: String,
        enum: ['cm', 'in', 'm', 'ft'],
        default: 'cm'
      }
    },
    // Location status
    status: {
      type: String,
      enum: ['active', 'inactive', 'maintenance', 'full', 'reserved'],
      default: 'active',
      index: true
    },
    // Restrictions
    restrictions: {
      allowMixedProducts: {
        type: Boolean,
        default: true
      },
      allowMixedBatches: {
        type: Boolean,
        default: true
      },
      temperatureControlled: {
        type: Boolean,
        default: false
      },
      hazardousMaterialsOnly: {
        type: Boolean,
        default: false
      },
      restrictedAccess: {
        type: Boolean,
        default: false
      }
    },
    // Picking priority (lower number = higher priority)
    pickingPriority: {
      type: Number,
      default: 99,
      min: 1,
      max: 99
    },
    // Putaway strategy
    putawayStrategy: {
      type: String,
      enum: ['fifo', 'lifo', 'fefo', 'random', 'fixed'],
      default: 'fifo'
    },
    // Fixed product assignment (if using fixed location strategy)
    fixedProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    // Barcode/QR code for scanning
    barcode: {
      type: String,
      trim: true,
      sparse: true,
      index: true
    },
    // GPS coordinates (for large warehouses)
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    // Notes
    notes: String,
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound indexes
WarehouseLocationSchema.index({ organization: 1, warehouse: 1, locationCode: 1 }, { unique: true });
WarehouseLocationSchema.index({ warehouse: 1, zone: 1, aisle: 1 });
WarehouseLocationSchema.index({ warehouse: 1, locationType: 1, status: 1 });

// Virtual for full location path
WarehouseLocationSchema.virtual('fullPath').get(function() {
  const parts = [];
  if (this.zone) parts.push(this.zone);
  if (this.aisle) parts.push(this.aisle);
  if (this.rack) parts.push(this.rack);
  if (this.shelf) parts.push(this.shelf);
  if (this.bin) parts.push(this.bin);
  return parts.length > 0 ? parts.join('-') : this.locationCode;
});

// Virtual for capacity utilization percentage
WarehouseLocationSchema.virtual('utilizationPercentage').get(function() {
  if (!this.capacity.maxUnits || this.capacity.maxUnits === 0) return 0;
  return (this.currentUtilization.units / this.capacity.maxUnits) * 100;
});

// Virtual for available capacity
WarehouseLocationSchema.virtual('availableCapacity').get(function() {
  return {
    weight: (this.capacity.maxWeight || 0) - (this.currentUtilization.weight || 0),
    volume: (this.capacity.maxVolume || 0) - (this.currentUtilization.volume || 0),
    units: (this.capacity.maxUnits || 0) - (this.currentUtilization.units || 0)
  };
});

// Method to check if location can accommodate item
WarehouseLocationSchema.methods.canAccommodate = function(weight, volume, units) {
  const available = this.availableCapacity;
  
  if (this.status !== 'active') return false;
  if (this.capacity.maxWeight && weight > available.weight) return false;
  if (this.capacity.maxVolume && volume > available.volume) return false;
  if (this.capacity.maxUnits && units > available.units) return false;
  
  return true;
};

// Method to update utilization
WarehouseLocationSchema.methods.updateUtilization = function(weightDelta, volumeDelta, unitsDelta) {
  this.currentUtilization.weight += weightDelta;
  this.currentUtilization.volume += volumeDelta;
  this.currentUtilization.units += unitsDelta;
  
  // Check if location is full
  if (this.capacity.maxUnits && this.currentUtilization.units >= this.capacity.maxUnits) {
    this.status = 'full';
  } else if (this.status === 'full') {
    this.status = 'active';
  }
  
  return this.save();
};

// Static method to find optimal location for putaway
WarehouseLocationSchema.statics.findOptimalLocation = async function(
  warehouseId, 
  productId, 
  quantity, 
  options = {}
) {
  const query = {
    warehouse: warehouseId,
    status: 'active',
    isActive: true
  };

  // If product has fixed location
  if (options.useFixedLocation) {
    query.fixedProduct = productId;
  }

  // Filter by location type
  if (options.locationType) {
    query.locationType = options.locationType;
  } else {
    query.locationType = { $in: ['reserve', 'general', 'picking'] };
  }

  const locations = await this.find(query)
    .sort({ pickingPriority: 1, utilizationPercentage: 1 });

  // Find first location with enough capacity
  for (const location of locations) {
    if (location.canAccommodate(options.weight || 0, options.volume || 0, quantity)) {
      return location;
    }
  }

  return null;
};

// Pre-save middleware to generate location code if not provided
WarehouseLocationSchema.pre('save', function(next) {
  if (!this.locationCode && this.zone) {
    const parts = [this.zone, this.aisle, this.rack, this.shelf, this.bin].filter(Boolean);
    this.locationCode = parts.join('-');
  }
  next();
});

module.exports = mongoose.model('WarehouseLocation', WarehouseLocationSchema);

