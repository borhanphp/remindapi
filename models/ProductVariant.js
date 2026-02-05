const mongoose = require('mongoose');

const ProductVariantSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    parentProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    // Variant identification
    variantName: {
      type: String,
      required: true,
      trim: true
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    // Variant options (e.g., Size: "Large", Color: "Red")
    options: [{
      optionName: {
        type: String,
        required: true,
        trim: true
      },
      optionValue: {
        type: String,
        required: true,
        trim: true
      }
    }],
    // Pricing (can override parent product pricing)
    price: {
      type: Number,
      min: [0, 'Price cannot be negative']
    },
    costPrice: {
      type: Number,
      min: [0, 'Cost price cannot be negative']
    },
    compareAtPrice: {
      type: Number,
      min: [0, 'Compare at price cannot be negative']
    },
    // Inventory
    quantity: {
      type: Number,
      default: 0,
      min: [0, 'Quantity cannot be negative']
    },
    reservedQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Reserved quantity cannot be negative']
    },
    reorderLevel: {
      type: Number,
      default: 0,
      min: [0, 'Reorder level cannot be negative']
    },
    // Warehouse specific inventory
    warehouseInventory: [{
      warehouse: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Warehouse',
        required: true
      },
      quantity: {
        type: Number,
        default: 0,
        min: 0
      },
      reservedQuantity: {
        type: Number,
        default: 0,
        min: 0
      }
    }],
    // Variant-specific attributes
    weight: {
      value: Number,
      unit: {
        type: String,
        enum: ['kg', 'g', 'lb', 'oz'],
        default: 'kg'
      }
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
    // Images (variant-specific images)
    images: [{
      url: {
        type: String,
        required: true
      },
      alt: String,
      position: {
        type: Number,
        default: 0
      },
      isPrimary: {
        type: Boolean,
        default: false
      }
    }],
    // Barcode
    barcode: {
      type: String,
      trim: true,
      sparse: true,
      index: true
    },
    // Tax override
    taxRate: {
      type: Number,
      min: 0
    },
    // Status
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    // Position/order (for display ordering)
    position: {
      type: Number,
      default: 0
    },
    // Metadata
    metadata: {
      type: Map,
      of: String,
      default: {}
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
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

// Indexes
ProductVariantSchema.index({ organization: 1, parentProduct: 1 });
ProductVariantSchema.index({ organization: 1, sku: 1 }, { unique: true });
ProductVariantSchema.index({ 'options.optionName': 1, 'options.optionValue': 1 });

// Virtual for available quantity
ProductVariantSchema.virtual('availableQuantity').get(function() {
  return this.quantity - this.reservedQuantity;
});

// Virtual for formatted variant name with options
ProductVariantSchema.virtual('fullVariantName').get(function() {
  const optionStr = this.options.map(opt => opt.optionValue).join(' / ');
  return `${this.variantName} (${optionStr})`;
});

// Static method to generate variant SKU
ProductVariantSchema.statics.generateVariantSKU = function(parentSKU, options) {
  const optionCodes = options.map(opt => {
    const value = opt.optionValue.substring(0, 2).toUpperCase();
    return value;
  }).join('-');
  
  return `${parentSKU}-${optionCodes}`;
};

// Static method to create variants from option matrix
ProductVariantSchema.statics.generateVariantsFromMatrix = async function(
  parentProduct,
  optionDefinitions,
  userId
) {
  // optionDefinitions example: [
  //   { name: 'Size', values: ['S', 'M', 'L'] },
  //   { name: 'Color', values: ['Red', 'Blue', 'Green'] }
  // ]
  
  const variants = [];
  
  // Generate all combinations
  function generateCombinations(arrays, prefix = []) {
    if (arrays.length === 0) {
      return [prefix];
    }
    
    const [first, ...rest] = arrays;
    const combinations = [];
    
    for (const value of first.values) {
      const newPrefix = [...prefix, { optionName: first.name, optionValue: value }];
      combinations.push(...generateCombinations(rest, newPrefix));
    }
    
    return combinations;
  }
  
  const combinations = generateCombinations(optionDefinitions);
  
  for (const options of combinations) {
    const variantName = options.map(opt => opt.optionValue).join(' / ');
    const sku = this.generateVariantSKU(parentProduct.sku, options);
    
    variants.push({
      organization: parentProduct.organization,
      parentProduct: parentProduct._id,
      variantName,
      sku,
      options,
      price: parentProduct.price,
      costPrice: parentProduct.costPrice,
      quantity: 0,
      isActive: true,
      createdBy: userId
    });
  }
  
  return variants;
};

// Method to update inventory across warehouses
ProductVariantSchema.methods.updateWarehouseInventory = async function(warehouseId, quantityDelta) {
  const warehouseInv = this.warehouseInventory.find(inv => 
    inv.warehouse.toString() === warehouseId.toString()
  );
  
  if (warehouseInv) {
    warehouseInv.quantity += quantityDelta;
  } else {
    this.warehouseInventory.push({
      warehouse: warehouseId,
      quantity: Math.max(0, quantityDelta),
      reservedQuantity: 0
    });
  }
  
  // Update total quantity
  this.quantity = this.warehouseInventory.reduce((total, inv) => total + inv.quantity, 0);
  
  return this.save();
};

// Method to reserve inventory
ProductVariantSchema.methods.reserve = function(quantity, warehouseId = null) {
  if (this.availableQuantity < quantity) {
    throw new Error('Insufficient available quantity to reserve');
  }
  
  this.reservedQuantity += quantity;
  
  if (warehouseId) {
    const warehouseInv = this.warehouseInventory.find(inv => 
      inv.warehouse.toString() === warehouseId.toString()
    );
    if (warehouseInv) {
      warehouseInv.reservedQuantity += quantity;
    }
  }
  
  return this.save();
};

// Method to unreserve inventory
ProductVariantSchema.methods.unreserve = function(quantity, warehouseId = null) {
  this.reservedQuantity = Math.max(0, this.reservedQuantity - quantity);
  
  if (warehouseId) {
    const warehouseInv = this.warehouseInventory.find(inv => 
      inv.warehouse.toString() === warehouseId.toString()
    );
    if (warehouseInv) {
      warehouseInv.reservedQuantity = Math.max(0, warehouseInv.reservedQuantity - quantity);
    }
  }
  
  return this.save();
};

// Pre-save middleware to ensure primary image
ProductVariantSchema.pre('save', function(next) {
  if (this.images.length > 0) {
    const hasPrimary = this.images.some(img => img.isPrimary);
    if (!hasPrimary) {
      this.images[0].isPrimary = true;
    }
  }
  next();
});

module.exports = mongoose.model('ProductVariant', ProductVariantSchema);

