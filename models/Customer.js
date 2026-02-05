const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: false // Temporarily optional during migration
    },
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      maxlength: [100, 'Customer name cannot be more than 100 characters']
    },
    email: {
      type: String,
      required: false, // Changed from required: true
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
      trim: true,
      maxlength: [20, 'Phone number cannot be more than 20 characters']
    },
    otp: {
      type: String,
      select: false // Don't return OTP in queries
    },
    otpExpires: {
      type: Date
    },
    alternatePhone: {
      type: String,
      trim: true,
      maxlength: [20, 'Phone number cannot be more than 20 characters']
    },
    company: {
      type: String,
      trim: true,
      maxlength: [200, 'Company name cannot be more than 200 characters']
    },
    type: {
      type: String,
      enum: ['retail', 'wholesale'],
      default: 'retail'
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    },
    address: {
      street: {
        type: String,
        trim: true,
        maxlength: [500, 'Street address cannot be more than 500 characters']
      },
      city: {
        type: String,
        trim: true,
        maxlength: [100, 'City cannot be more than 100 characters']
      },
      state: {
        type: String,
        trim: true,
        maxlength: [100, 'State cannot be more than 100 characters']
      },
      country: {
        type: String,
        trim: true,
        default: 'USA',
        maxlength: [100, 'Country cannot be more than 100 characters']
      },
      postalCode: {
        type: String,
        trim: true,
        maxlength: [20, 'Postal code cannot be more than 20 characters']
      }
    },
    billingAddress: {
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
    creditLimit: {
      type: Number,
      default: 0,
      min: [0, 'Credit limit cannot be negative']
    },
    taxNumber: {
      type: String,
      trim: true,
      maxlength: [50, 'Tax number cannot be more than 50 characters']
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
CustomerSchema.index({
  name: 'text',
  email: 'text',
  phone: 'text',
  company: 'text'
});

// Add compound index for common queries
CustomerSchema.index({ status: 1, type: 1 });
CustomerSchema.index({ organization: 1, phone: 1 }, { unique: true });
// Partial index - only index documents where email exists and is not empty
CustomerSchema.index(
  { organization: 1, email: 1 },
  {
    unique: true,
    name: 'organization_1_email_1_partial',
    partialFilterExpression: {
      email: { $type: 'string', $gt: '' }
    }
  }
);

// Pre-save middleware to handle empty email strings
CustomerSchema.pre('save', function (next) {
  // Convert empty email string to undefined so sparse index works
  if (this.email === '') {
    this.email = undefined;
  }
  next();
});

module.exports = mongoose.model('Customer', CustomerSchema); 