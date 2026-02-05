const mongoose = require('mongoose');

const SupplierSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: false // Temporarily optional during migration
    },
    name: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
      maxlength: [100, 'Supplier name cannot be more than 100 characters']
    },
    code: {
      type: String,
      sparse: true,
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please enter a valid email'
      ]
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true
    },
    alternatePhone: {
      type: String,
      trim: true
    },
    contactPerson: {
      name: {
        type: String,
        trim: true
      },
      phone: {
        type: String,
        trim: true
      },
      email: {
        type: String,
        trim: true,
        lowercase: true
      },
      designation: {
        type: String,
        trim: true
      }
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    },
    address: {
      street: {
        type: String,
        trim: true
      },
      city: {
        type: String,
        trim: true
      },
      state: {
        type: String,
        trim: true
      },
      country: {
        type: String,
        trim: true,
        default: 'USA'
      },
      postalCode: {
        type: String,
        trim: true
      }
    },
    paymentTerms: {
      type: String,
      enum: ['cash', 'net15', 'net30', 'net45', 'net60', 'custom'],
      default: 'net30'
    },
    paymentTermsCustom: {
      type: String,
      trim: true
    },
    creditLimit: {
      type: Number,
      default: 0,
      min: [0, 'Credit limit cannot be negative']
    },
    taxNumber: {
      type: String,
      trim: true
    },
    bankDetails: {
      bankName: {
        type: String,
        trim: true
      },
      accountNumber: {
        type: String,
        trim: true
      },
      routingNumber: {
        type: String,
        trim: true
      },
      swiftCode: {
        type: String,
        trim: true
      }
    },
    website: {
      type: String,
      trim: true
    },
    categories: [{
      type: String,
      trim: true
    }],
    leadTime: {
      type: Number,
      default: 0,
      min: [0, 'Lead time cannot be negative']
    },
    minimumOrderAmount: {
      type: Number,
      default: 0,
      min: [0, 'Minimum order amount cannot be negative']
    },
    rating: {
      type: Number,
      min: [0, 'Rating cannot be negative'],
      max: [5, 'Rating cannot be more than 5'],
      default: 0
    },
    notes: {
      type: String,
      maxlength: [1000, 'Notes cannot be more than 1000 characters']
    },
    tags: [{
      type: String,
      trim: true
    }],
    totalPurchases: {
      type: Number,
      default: 0,
      min: [0, 'Total purchases cannot be negative']
    },
    lastPurchaseDate: {
      type: Date
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
  { timestamps: true }
);

// Add text index for search
SupplierSchema.index({ 
  name: 'text', 
  email: 'text', 
  phone: 'text',
  code: 'text'
});

// Add compound index for common queries
SupplierSchema.index({ status: 1, rating: -1 });
SupplierSchema.index({ organization: 1, code: 1 }, { unique: true });
SupplierSchema.index({ organization: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('Supplier', SupplierSchema); 