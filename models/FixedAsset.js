const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  description: {
    type: String,
    trim: true
  }
}, { _id: true });

const fixedAssetSchema = new mongoose.Schema({
  assetNumber: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },
  assetName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  assetCategory: {
    type: String,
    required: true,
    enum: ['Equipment', 'Vehicles', 'Computers', 'Furniture', 'Buildings', 'Land', 'Leasehold Improvements', 'Other'],
    index: true
  },
  description: {
    type: String,
    trim: true
  },
  serialNumber: {
    type: String,
    trim: true
  },
  
  // Purchase Information
  purchaseDate: {
    type: Date,
    required: true,
    index: true
  },
  purchaseCost: {
    type: Number,
    required: true,
    min: 0
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  invoiceNumber: {
    type: String,
    trim: true
  },
  
  // Depreciation
  depreciationMethod: {
    type: String,
    required: true,
    enum: ['straight-line', 'declining-balance', 'units-of-production', 'sum-of-years-digits'],
    default: 'straight-line'
  },
  usefulLife: {
    type: Number,
    required: true,
    min: 1,
    comment: 'Useful life in months'
  },
  salvageValue: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  depreciationStartDate: {
    type: Date,
    required: true
  },
  accumulatedDepreciation: {
    type: Number,
    default: 0,
    min: 0
  },
  lastDepreciationDate: {
    type: Date
  },
  
  // Location & Assignment
  location: {
    type: String,
    trim: true,
    index: true
  },
  department: {
    type: String,
    trim: true,
    index: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Disposal
  status: {
    type: String,
    required: true,
    enum: ['active', 'disposed', 'sold'],
    default: 'active',
    index: true
  },
  disposalDate: {
    type: Date
  },
  disposalAmount: {
    type: Number,
    min: 0
  },
  disposalMethod: {
    type: String,
    enum: ['sale', 'scrap', 'donation', 'trade-in', 'other']
  },
  disposalNotes: {
    type: String,
    trim: true
  },
  gainLoss: {
    type: Number,
    comment: 'Calculated gain (positive) or loss (negative) on disposal'
  },
  
  // Accounting Integration
  assetAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChartOfAccount',
    required: true
  },
  accumulatedDepAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChartOfAccount',
    required: true
  },
  depreciationExpAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChartOfAccount',
    required: true
  },
  
  // Documents & Files
  attachments: [attachmentSchema],
  
  // Multi-tenancy
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Virtual field for net book value
fixedAssetSchema.virtual('netBookValue').get(function() {
  return this.purchaseCost - this.accumulatedDepreciation;
});

// Virtual field for depreciable amount
fixedAssetSchema.virtual('depreciableAmount').get(function() {
  return this.purchaseCost - this.salvageValue;
});

// Validation: purchase cost must be greater than salvage value
fixedAssetSchema.pre('validate', function(next) {
  if (this.purchaseCost && this.salvageValue && this.purchaseCost <= this.salvageValue) {
    return next(new Error('Purchase cost must be greater than salvage value'));
  }
  
  // Depreciation start date must be >= purchase date
  if (this.depreciationStartDate && this.purchaseDate && this.depreciationStartDate < this.purchaseDate) {
    return next(new Error('Depreciation start date cannot be before purchase date'));
  }
  
  next();
});

// Compound index for organization and status
fixedAssetSchema.index({ organization: 1, status: 1 });
fixedAssetSchema.index({ organization: 1, assetCategory: 1 });
fixedAssetSchema.index({ organization: 1, location: 1 });

// Static method to generate next asset number
fixedAssetSchema.statics.generateAssetNumber = async function(organizationId) {
  const year = new Date().getFullYear();
  const prefix = `FA-${year}-`;
  
  // Find the last asset number for this year and organization
  const lastAsset = await this.findOne({
    organization: organizationId,
    assetNumber: new RegExp(`^${prefix}`)
  })
  .sort({ assetNumber: -1 })
  .lean();
  
  let nextNumber = 1;
  if (lastAsset && lastAsset.assetNumber) {
    const lastNumberStr = lastAsset.assetNumber.split('-')[2];
    const lastNumber = parseInt(lastNumberStr, 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }
  
  // Pad with zeros (e.g., 001, 002, etc.)
  const paddedNumber = String(nextNumber).padStart(3, '0');
  return `${prefix}${paddedNumber}`;
};

// Static method to get asset summary by category
fixedAssetSchema.statics.getSummaryByCategory = async function(organizationId) {
  return this.aggregate([
    {
      $match: {
        organization: new mongoose.Types.ObjectId(organizationId),
        status: 'active'
      }
    },
    {
      $group: {
        _id: '$assetCategory',
        count: { $sum: 1 },
        totalCost: { $sum: '$purchaseCost' },
        totalAccumulatedDepreciation: { $sum: '$accumulatedDepreciation' },
        totalNetBookValue: { $sum: { $subtract: ['$purchaseCost', '$accumulatedDepreciation'] } }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
};

// Ensure virtuals are included in JSON
fixedAssetSchema.set('toJSON', { virtuals: true });
fixedAssetSchema.set('toObject', { virtuals: true });

const FixedAsset = mongoose.model('FixedAsset', fixedAssetSchema);

module.exports = FixedAsset;

