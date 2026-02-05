const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: false // Temporarily optional during migration
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [100, 'Product name cannot be more than 100 characters']
    },
    sku: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      index: true
    },
    description: {
      type: String,
      maxlength: [1000, 'Description cannot be more than 1000 characters']
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true
    },
    brand: {
      type: String,
      trim: true
    },
    price: {
      type: Number,
      required: [true, 'Selling price is required'],
      min: [0, 'Price cannot be negative']
    },
    costPrice: {
      type: Number,
      min: [0, 'Cost price cannot be negative']
    },
    tax: {
      rate: {
        type: Number,
        min: 0,
        default: 0
      },
      inclusive: {
        type: Boolean,
        default: false
      }
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity cannot be negative'],
      default: 0
    },
    // Add version tracking for optimistic locking
    version: {
      type: Number,
      default: 0
    },
    // Add temporary reservations tracking
    temporaryReservations: [{
      orderId: {
        type: String,
        required: true
      },
      quantity: {
        type: Number,
        required: true,
        min: [1, 'Reserved quantity must be at least 1']
      },
      expiresAt: {
        type: Date,
        required: true
      }
    }],

    unit: {
      type: String,
      default: 'piece',
      trim: true
    },
    reorderLevel: {
      type: Number,
      default: 5,
      min: [0, 'Reorder level cannot be negative']
    },
    isActive: {
      type: Boolean,
      default: true
    },
    images: [
      {
        url: String,
        thumbnail: String, // Thumbnail URL for faster loading
        alt: String,
        isPrimary: {
          type: Boolean,
          default: false
        }
      }
    ],
    barcode: {
      type: String,
      trim: true
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier'
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse'
    },
    attributes: {
      type: Map,
      of: String,
      default: {}
    },
    // Batch/Serial Tracking Configuration
    trackingType: {
      type: String,
      enum: ['none', 'batch', 'serial'],
      default: 'none',
      index: true
    },
    requireBatchOnReceipt: {
      type: Boolean,
      default: false
    },
    requireSerialOnReceipt: {
      type: Boolean,
      default: false
    },
    // Inventory Valuation Method
    valuationMethod: {
      type: String,
      enum: ['fifo', 'lifo', 'weighted_average', 'standard'],
      default: 'fifo',
      index: true
    },
    standardCost: {
      type: Number,
      min: 0,
      default: 0
    },
    // Product Variant Fields
    isVariantProduct: {
      type: Boolean,
      default: false,
      index: true
    },
    parentProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      index: true
    },
    variantOptions: [{
      optionName: {
        type: String,
        trim: true
      },
      optionValue: {
        type: String,
        trim: true
      }
    }],
    // Product Kit/Assembly Fields
    isKit: {
      type: Boolean,
      default: false,
      index: true
    },
    kitComponents: [{
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      },
      quantity: {
        type: Number,
        min: 0.01,
        required: true
      },
      unitCost: Number
    }],
    kitPricingStrategy: {
      type: String,
      enum: ['sum_of_parts', 'bundle_discount', 'fixed_price'],
      default: 'fixed_price'
    },
    // Safety Stock & Reorder Settings
    safetyStock: {
      type: Number,
      default: 0,
      min: 0
    },
    reorderQuantity: {
      type: Number,
      default: 0,
      min: 0
    },
    leadTimeDays: {
      type: Number,
      default: 0,
      min: 0
    },
    // Allow negative inventory
    allowNegativeStock: {
      type: Boolean,
      default: false
    },
    // SEO Fields
    slug: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
      set: v => v === '' ? undefined : v // Convert empty string to undefined for sparse index
    },
    metaTitle: {
      type: String,
      trim: true,
      maxlength: [60, 'Meta title too long (max 60)']
    },
    metaDescription: {
      type: String,
      trim: true,
      maxlength: [160, 'Meta description too long (max 160)']
    },
    // Organization & Categorization
    tags: [{
      type: String,
      trim: true
    }],
    // Shipping Information
    weight: {
      value: {
        type: Number,
        min: 0,
        default: 0
      },
      unit: {
        type: String,
        enum: ['kg', 'g', 'lb', 'oz'],
        default: 'kg'
      }
    },
    dimensions: {
      length: {
        type: Number,
        min: 0,
        default: 0
      },
      width: {
        type: Number,
        min: 0,
        default: 0
      },
      height: {
        type: Number,
        min: 0,
        default: 0
      },
      unit: {
        type: String,
        enum: ['cm', 'in', 'm'],
        default: 'cm'
      }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Add available quantity virtual (actual - temporary reservations)
ProductSchema.virtual('availableQuantity').get(function () {
  const reservedQty = this.temporaryReservations ? this.temporaryReservations.reduce((total, res) => {
    // Only count non-expired reservations
    if (res.expiresAt > new Date()) {
      return total + res.quantity;
    }
    return total;
  }, 0) : 0;
  return this.quantity - reservedQty;
});

// Add text index for search
ProductSchema.index({
  name: 'text',
  description: 'text',
  sku: 'text',
  category: 'text',
  brand: 'text'
});

// Add index for temporary reservations expiry
ProductSchema.index({ 'temporaryReservations.expiresAt': 1 });

// Pre-save middleware to increment version
ProductSchema.pre('save', function (next) {
  this.version++;
  next();
});

// Pre-save middleware to clean up expired reservations
ProductSchema.pre('save', function (next) {
  const now = new Date();
  this.temporaryReservations = this.temporaryReservations.filter(res => res.expiresAt > now);
  next();
});

module.exports = mongoose.model('Product', ProductSchema); 