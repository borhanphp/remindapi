const mongoose = require('mongoose');

const OptionSchema = new mongoose.Schema({
  label: { type: String, required: true },
  value: { type: String, required: true },
  color: { type: String },
  order: { type: Number, default: 0 },
}, { _id: true });

const CustomFieldSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  key: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  description: {
    type: String,
    trim: true,
  },
  fieldType: {
    type: String,
    enum: ['text', 'number', 'date', 'datetime', 'boolean', 'dropdown', 'multi-select', 'user', 'url', 'email'],
    required: true,
  },
  // Applies to which entities
  appliesTo: {
    type: String,
    enum: ['task', 'project', 'both'],
    required: true,
    index: true,
  },
  // For dropdown and multi-select types
  options: [OptionSchema],
  // Validation rules
  validation: {
    required: { type: Boolean, default: false },
    min: { type: Number },
    max: { type: Number },
    pattern: { type: String }, // regex pattern for text fields
    minDate: { type: Date },
    maxDate: { type: Date },
  },
  // Default value
  defaultValue: {
    type: mongoose.Schema.Types.Mixed,
  },
  // Display settings
  display: {
    showInList: { type: Boolean, default: false },
    showInCard: { type: Boolean, default: true },
    showInDetails: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  // Active status
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  // Project-specific field (null means org-wide)
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    index: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

// Compound indexes
CustomFieldSchema.index({ organization: 1, appliesTo: 1, isActive: 1 });
CustomFieldSchema.index({ organization: 1, project: 1, appliesTo: 1 });
CustomFieldSchema.index({ organization: 1, key: 1 }, { unique: true });

// Method to validate value
CustomFieldSchema.methods.validateValue = function(value) {
  const errors = [];
  
  if (this.validation.required && (value === null || value === undefined || value === '')) {
    errors.push('Field is required');
  }
  
  if (value !== null && value !== undefined && value !== '') {
    switch (this.fieldType) {
      case 'number':
        if (typeof value !== 'number') {
          errors.push('Value must be a number');
        } else {
          if (this.validation.min !== undefined && value < this.validation.min) {
            errors.push(`Value must be at least ${this.validation.min}`);
          }
          if (this.validation.max !== undefined && value > this.validation.max) {
            errors.push(`Value must be at most ${this.validation.max}`);
          }
        }
        break;
      
      case 'text':
        if (typeof value !== 'string') {
          errors.push('Value must be a string');
        } else {
          if (this.validation.min && value.length < this.validation.min) {
            errors.push(`Value must be at least ${this.validation.min} characters`);
          }
          if (this.validation.max && value.length > this.validation.max) {
            errors.push(`Value must be at most ${this.validation.max} characters`);
          }
          if (this.validation.pattern) {
            const regex = new RegExp(this.validation.pattern);
            if (!regex.test(value)) {
              errors.push('Value does not match required pattern');
            }
          }
        }
        break;
      
      case 'date':
      case 'datetime':
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          errors.push('Invalid date');
        } else {
          if (this.validation.minDate && date < this.validation.minDate) {
            errors.push(`Date must be after ${this.validation.minDate.toISOString()}`);
          }
          if (this.validation.maxDate && date > this.validation.maxDate) {
            errors.push(`Date must be before ${this.validation.maxDate.toISOString()}`);
          }
        }
        break;
      
      case 'dropdown':
        const validOption = this.options.some(opt => opt.value === value);
        if (!validOption) {
          errors.push('Invalid option selected');
        }
        break;
      
      case 'multi-select':
        if (!Array.isArray(value)) {
          errors.push('Value must be an array');
        } else {
          const invalidOptions = value.filter(v => !this.options.some(opt => opt.value === v));
          if (invalidOptions.length > 0) {
            errors.push(`Invalid options: ${invalidOptions.join(', ')}`);
          }
        }
        break;
      
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push('Value must be a boolean');
        }
        break;
      
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors.push('Invalid email address');
        }
        break;
      
      case 'url':
        try {
          new URL(value);
        } catch {
          errors.push('Invalid URL');
        }
        break;
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

module.exports = mongoose.model('CustomField', CustomFieldSchema);

