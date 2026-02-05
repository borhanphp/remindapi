const mongoose = require('mongoose');

const InvoiceTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    type: {
      type: String,
      enum: ['modern', 'classic', 'minimal', 'professional', 'corporate'],
      required: true
    },
    layout: {
      headerSection: {
        show: { type: Boolean, default: true },
        logoPosition: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
        showCompanyDetails: { type: Boolean, default: true }
      },
      bodySection: {
        showProductImages: { type: Boolean, default: false },
        showProductSKU: { type: Boolean, default: true },
        itemTableStyle: { type: String, enum: ['bordered', 'striped', 'minimal'], default: 'bordered' }
      },
      footerSection: {
        show: { type: Boolean, default: true },
        showFooterLogo: { type: Boolean, default: false },
        logoPosition: { type: String, enum: ['left', 'center', 'right'], default: 'center' }
      }
    },
    colorScheme: {
      primaryColor: { type: String, default: '#4F46E5' }, // Indigo-600
      secondaryColor: { type: String, default: '#6B7280' }, // Gray-500
      accentColor: { type: String, default: '#10B981' }, // Green-500
      textColor: { type: String, default: '#1F2937' }, // Gray-800
      backgroundColor: { type: String, default: '#FFFFFF' }
    },
    fonts: {
      headingFont: { type: String, default: 'Inter' },
      bodyFont: { type: String, default: 'Inter' },
      headingSize: { type: String, default: '24px' },
      bodySize: { type: String, default: '14px' }
    },
    sections: {
      showCompanyAddress: { type: Boolean, default: true },
      showTaxInfo: { type: Boolean, default: true },
      showPaymentTerms: { type: Boolean, default: true },
      showNotes: { type: Boolean, default: true },
      showBankDetails: { type: Boolean, default: false },
      showSignature: { type: Boolean, default: true },
      showQRCode: { type: Boolean, default: false }
    },
    customFields: [
      {
        name: { type: String, required: true },
        label: { type: String, required: true },
        type: { type: String, enum: ['text', 'number', 'date', 'textarea'], default: 'text' },
        required: { type: Boolean, default: false },
        placeholder: String,
        defaultValue: String,
        position: { type: String, enum: ['header', 'body', 'footer'], default: 'body' }
      }
    ],
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    },
    isSystem: {
      type: Boolean,
      default: false // System templates cannot be deleted
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

// Index for searching
InvoiceTemplateSchema.index({ name: 'text', description: 'text' });
InvoiceTemplateSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('InvoiceTemplate', InvoiceTemplateSchema);

