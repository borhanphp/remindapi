const mongoose = require('mongoose');

const POSSettingsSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true
    },
    // General settings
    defaultWarehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse'
    },
    requireCustomer: {
      type: Boolean,
      default: false
    },
    allowPriceOverride: {
      type: Boolean,
      default: false
    },
    allowDiscount: {
      type: Boolean,
      default: true
    },
    maxDiscountPercentage: {
      type: Number,
      default: 100,
      min: [0, 'Max discount percentage cannot be negative'],
      max: [100, 'Max discount percentage cannot exceed 100']
    },
    // Tax settings
    defaultTaxRate: {
      type: Number,
      default: 0,
      min: [0, 'Tax rate cannot be negative']
    },
    taxInclusive: {
      type: Boolean,
      default: false
    },
    // Receipt settings
    receiptSettings: {
      header: {
        type: String,
        maxlength: [200, 'Receipt header cannot be more than 200 characters']
      },
      footer: {
        type: String,
        maxlength: [200, 'Receipt footer cannot be more than 200 characters']
      },
      showLogo: {
        type: Boolean,
        default: false
      },
      logoUrl: String,
      showBarcode: {
        type: Boolean,
        default: true
      },
      showTaxBreakdown: {
        type: Boolean,
        default: true
      },
      showPaymentMethod: {
        type: Boolean,
        default: true
      },
      paperWidth: {
        type: Number,
        default: 80
      },
      fontSize: {
        type: Number,
        default: 12
      },
      printCustomerCopy: {
        type: Boolean,
        default: true
      },
      printMerchantCopy: {
        type: Boolean,
        default: false
      },
      emailReceipt: {
        type: Boolean,
        default: false
      },
      smsReceipt: {
        type: Boolean,
        default: false
      }
    },
    // Payment gateway settings
    paymentGateway: {
      provider: {
        type: String,
        enum: ['stripe', 'square', 'paypal', 'none'],
        default: 'none'
      },
      stripe: {
        publishableKey: String,
        secretKey: String,
        webhookSecret: String
      },
      square: {
        applicationId: String,
        accessToken: String,
        locationId: String
      },
      paypal: {
        clientId: String,
        clientSecret: String,
        mode: {
          type: String,
          enum: ['sandbox', 'live'],
          default: 'sandbox'
        }
      }
    },
    // Hardware settings
    hardwareSettings: {
      autoOpenDrawer: {
        type: Boolean,
        default: true
      },
      printReceipt: {
        type: Boolean,
        default: true
      },
      showCustomerDisplay: {
        type: Boolean,
        default: false
      },
      barcodeScannerEnabled: {
        type: Boolean,
        default: true
      }
    },
    // Session settings
    sessionSettings: {
      requireOpeningCash: {
        type: Boolean,
        default: true
      },
      allowMultipleSessions: {
        type: Boolean,
        default: false
      },
      autoCloseSession: {
        type: Boolean,
        default: false
      },
      autoCloseTime: {
        type: String // HH:mm format
      }
    },
    // Offline settings
    offlineSettings: {
      enableOfflineMode: {
        type: Boolean,
        default: true
      },
      syncInterval: {
        type: Number,
        default: 30000, // 30 seconds in milliseconds
        min: [1000, 'Sync interval must be at least 1 second']
      },
      maxRetries: {
        type: Number,
        default: 5,
        min: [1, 'Max retries must be at least 1']
      },
      cacheProductData: {
        type: Boolean,
        default: true
      },
      cacheCustomerData: {
        type: Boolean,
        default: true
      },
      productCacheExpiry: {
        type: Number,
        default: 3600000 // 1 hour in milliseconds
      },
      customerCacheExpiry: {
        type: Number,
        default: 86400000 // 24 hours in milliseconds
      }
    },
    // UI settings
    uiSettings: {
      theme: {
        type: String,
        enum: ['light', 'dark'],
        default: 'light'
      },
      showProductImages: {
        type: Boolean,
        default: true
      },
      productsPerPage: {
        type: Number,
        default: 20,
        min: [10, 'Products per page must be at least 10'],
        max: [100, 'Products per page cannot exceed 100']
      },
      quickProductButtons: {
        type: Boolean,
        default: true
      },
      quickProductCount: {
        type: Number,
        default: 10,
        min: [0, 'Quick product count cannot be negative']
      }
    }
  },
  {
    timestamps: true
  }
);

// Indexes
POSSettingsSchema.index({ organization: 1 });

// Static method to get or create settings
POSSettingsSchema.statics.getOrCreate = async function(organizationId) {
  let settings = await this.findOne({ organization: organizationId });
  
  if (!settings) {
    settings = await this.create({ organization: organizationId });
  }
  
  return settings;
};

module.exports = mongoose.model('POSSettings', POSSettingsSchema);

