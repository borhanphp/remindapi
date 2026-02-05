const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Organization name is required'],
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'pro'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'trial', 'expired', 'cancelled', 'past_due'],
      default: 'trial'
    },
    trialEndsAt: {
      type: Date,
      default: () => new Date(+new Date() + 14 * 24 * 60 * 60 * 1000) // 14 days trial
    },
    currentPeriodEnd: Date,
    paddleCustomerId: String,
    paddleSubscriptionId: String
  },
  // Company Information
  logo: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  address: {
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    zipCode: { type: String, default: '' },
    country: { type: String, default: '' }
  },
  // Tax & Legal Information
  taxId: {
    type: String,
    trim: true
  },
  registrationNumber: {
    type: String,
    trim: true
  },
  vatNumber: {
    type: String,
    trim: true
  },
  // Financial Information
  bankDetails: {
    bankName: { type: String, default: '' },
    accountName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    routingNumber: { type: String, default: '' },
    swiftCode: { type: String, default: '' },
    iban: { type: String, default: '' }
  },
  // Document Settings
  invoiceFooter: {
    type: String,
    default: ''
  },
  signature: {
    type: String,
    default: ''
  },
  termsAndConditions: {
    type: String,
    default: ''
  },
  settings: {
    currency: {
      type: String,
      default: 'USD'
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    dateFormat: {
      type: String,
      default: 'YYYY-MM-DD'
    },
    fiscalYearStart: {
      type: String,
      default: '01-01'
    },
    language: {
      type: String,
      default: 'en'
    }
  },
  features: {
    maxInvoices: {
      type: Number,
      default: 5 // Free plan limit
    },
    emailReminders: {
      type: Boolean,
      default: true
    },
    basicReporting: {
      type: Boolean,
      default: true
    },
    automatedSchedule: {
      type: Boolean,
      default: false
    },
    prioritySupport: {
      type: Boolean,
      default: false
    },
    removeBranding: {
      type: Boolean,
      default: false
    }
  },
  modules: {
    type: [String],
    enum: ['inventory', 'accounting', 'hrm', 'crm', 'projects', 'custom-invoicing'],
    default: ['inventory'], // Default to inventory module only
    validate: {
      validator: function (v) {
        return Array.isArray(v) && v.length > 0;
      },
      message: 'Organization must have at least one module enabled'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
organizationSchema.index({ slug: 1 });

module.exports = mongoose.model('Organization', organizationSchema); 