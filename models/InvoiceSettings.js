const mongoose = require('mongoose');

const InvoiceSettingsSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
      index: true
    },
    // Default Template
    defaultTemplate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InvoiceTemplate'
    },
    // Invoice Numbering
    invoiceNumbering: {
      format: { type: String, default: 'INV-{YYYY}-{####}' },
      prefix: { type: String, default: 'INV' },
      suffix: { type: String, default: '' },
      padding: { type: Number, default: 4, min: 1, max: 10 },
      nextNumber: { type: Number, default: 1 },
      resetYearly: { type: Boolean, default: true },
      lastResetYear: { type: Number }
    },
    // Estimate Numbering
    estimateNumbering: {
      format: { type: String, default: 'EST-{YYYY}-{####}' },
      prefix: { type: String, default: 'EST' },
      suffix: { type: String, default: '' },
      padding: { type: Number, default: 4, min: 1, max: 10 },
      nextNumber: { type: Number, default: 1 },
      resetYearly: { type: Boolean, default: true },
      lastResetYear: { type: Number }
    },
    // Payment Terms
    defaultPaymentTerms: {
      type: String,
      default: 'Net 30'
    },
    paymentTermsOptions: [
      {
        type: String
      }
    ],
    defaultDueDays: {
      type: Number,
      default: 30
    },
    // Currency
    defaultCurrency: {
      code: { type: String, default: 'USD' },
      symbol: { type: String, default: '$' }
    },
    enableMultiCurrency: {
      type: Boolean,
      default: false
    },
    exchangeRateSource: {
      type: String,
      enum: ['manual', 'api'],
      default: 'api'
    },
    // Tax Settings
    defaultTaxRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    taxLabel: {
      type: String,
      default: 'Tax'
    },
    taxInclusive: {
      type: Boolean,
      default: false
    },
    // Email Templates
    emailTemplates: {
      invoice: {
        subject: { type: String, default: 'Invoice {INVOICE_NUMBER} from {COMPANY_NAME}' },
        body: { 
          type: String, 
          default: 'Dear {CUSTOMER_NAME},\n\nPlease find attached invoice {INVOICE_NUMBER} for {TOTAL_AMOUNT}.\n\nPayment is due by {DUE_DATE}.\n\nThank you for your business!\n\n{COMPANY_NAME}'
        }
      },
      estimate: {
        subject: { type: String, default: 'Estimate {ESTIMATE_NUMBER} from {COMPANY_NAME}' },
        body: { 
          type: String, 
          default: 'Dear {CUSTOMER_NAME},\n\nPlease find attached estimate {ESTIMATE_NUMBER} for {TOTAL_AMOUNT}.\n\nThis estimate is valid until {VALIDITY_DATE}.\n\nWe look forward to working with you!\n\n{COMPANY_NAME}'
        }
      },
      reminder: {
        subject: { type: String, default: 'Payment Reminder for Invoice {INVOICE_NUMBER}' },
        body: { 
          type: String, 
          default: 'Dear {CUSTOMER_NAME},\n\nThis is a friendly reminder that invoice {INVOICE_NUMBER} for {TOTAL_AMOUNT} is due on {DUE_DATE}.\n\nPlease let us know if you have any questions.\n\n{COMPANY_NAME}'
        }
      }
    },
    // Logo URLs
    logos: {
      headerLogo: { type: String },
      footerLogo: { type: String }
    },
    // Company Details Display
    companyDisplay: {
      showAddress: { type: Boolean, default: true },
      showPhone: { type: Boolean, default: true },
      showEmail: { type: Boolean, default: true },
      showWebsite: { type: Boolean, default: true },
      showTaxId: { type: Boolean, default: true },
      showRegistrationNumber: { type: Boolean, default: false }
    },
    // Payment Instructions
    paymentInstructions: {
      type: String,
      default: ''
    },
    // Bank Details for Invoice
    showBankDetails: {
      type: Boolean,
      default: false
    },
    // Late Fee Settings
    lateFee: {
      enabled: { type: Boolean, default: false },
      type: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
      value: { type: Number, default: 0 },
      gracePeriodDays: { type: Number, default: 0 }
    },
    // Reminders
    autoReminders: {
      enabled: { type: Boolean, default: false },
      beforeDueDays: [{ type: Number }], // e.g., [7, 3, 1] for 7, 3, and 1 day before
      afterDueDays: [{ type: Number }]   // e.g., [1, 7, 14] for 1, 7, and 14 days after
    },
    // Notes & Terms
    defaultNotes: {
      type: String,
      default: ''
    },
    defaultTerms: {
      type: String,
      default: ''
    },
    // Client Portal
    clientPortal: {
      enabled: { type: Boolean, default: false },
      allowOnlinePayment: { type: Boolean, default: false },
      tokenExpiryDays: { type: Number, default: 30 }
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

// Ensure payment terms options include default
InvoiceSettingsSchema.pre('save', function (next) {
  if (this.defaultPaymentTerms && !this.paymentTermsOptions.includes(this.defaultPaymentTerms)) {
    this.paymentTermsOptions.push(this.defaultPaymentTerms);
  }
  
  // Add common payment terms if empty
  if (this.paymentTermsOptions.length === 0) {
    this.paymentTermsOptions = ['Due on Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Net 90'];
  }
  
  next();
});

module.exports = mongoose.model('InvoiceSettings', InvoiceSettingsSchema);

