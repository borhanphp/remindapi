const InvoiceSettings = require('../models/InvoiceSettings');
const CustomInvoice = require('../models/CustomInvoice');
const Estimate = require('../models/Estimate');

/**
 * Generate invoice or estimate number based on organization settings
 * @param {ObjectId} organizationId - Organization ID
 * @param {String} type - 'invoice' or 'estimate'
 * @param {Object} settings - Invoice settings (optional, will be fetched if not provided)
 * @returns {String} Generated number
 */
const generateInvoiceNumber = async (organizationId, type = 'invoice', settings = null) => {
  // Fetch settings if not provided
  if (!settings) {
    settings = await InvoiceSettings.findOne({ organization: organizationId });
  }

  // Use default settings if none exist
  const config = type === 'invoice' 
    ? settings?.invoiceNumbering || {
        format: 'INV-{YYYY}-{####}',
        prefix: 'INV',
        suffix: '',
        padding: 4,
        nextNumber: 1,
        resetYearly: true
      }
    : settings?.estimateNumbering || {
        format: 'EST-{YYYY}-{####}',
        prefix: 'EST',
        suffix: '',
        padding: 4,
        nextNumber: 1,
        resetYearly: true
      };

  // Check if we need to reset yearly counter
  const currentYear = new Date().getFullYear();
  if (config.resetYearly && config.lastResetYear && config.lastResetYear !== currentYear) {
    config.nextNumber = 1;
    config.lastResetYear = currentYear;
  } else if (!config.lastResetYear) {
    config.lastResetYear = currentYear;
  }

  // Generate number based on format
  const number = parseFormat(config.format, {
    number: config.nextNumber,
    padding: config.padding,
    prefix: config.prefix,
    suffix: config.suffix
  });

  // Increment counter
  config.nextNumber += 1;

  // Save updated settings
  if (settings) {
    if (type === 'invoice') {
      settings.invoiceNumbering = config;
    } else {
      settings.estimateNumbering = config;
    }
    await settings.save();
  }

  // Verify uniqueness
  const Model = type === 'invoice' ? CustomInvoice : Estimate;
  const field = type === 'invoice' ? 'invoiceNumber' : 'estimateNumber';
  const exists = await Model.findOne({
    [field]: number,
    organization: organizationId
  });

  // If number exists, recursively generate a new one
  if (exists) {
    return generateInvoiceNumber(organizationId, type, settings);
  }

  return number;
};

/**
 * Parse format string and replace placeholders
 * @param {String} format - Format string (e.g., "INV-{YYYY}-{####}")
 * @param {Object} params - Parameters for replacement
 * @returns {String} Formatted number
 */
const parseFormat = (format, params) => {
  const now = new Date();
  const { number, padding, prefix, suffix } = params;

  // Replace date placeholders
  let result = format
    .replace(/{YYYY}/g, now.getFullYear().toString())
    .replace(/{YY}/g, now.getFullYear().toString().slice(-2))
    .replace(/{MM}/g, String(now.getMonth() + 1).padStart(2, '0'))
    .replace(/{DD}/g, String(now.getDate()).padStart(2, '0'))
    .replace(/{PREFIX}/g, prefix || '')
    .replace(/{SUFFIX}/g, suffix || '');

  // Replace number placeholder with padded number
  const paddedNumber = String(number).padStart(padding || 4, '0');
  
  // Handle different number placeholder formats
  result = result
    .replace(/{\#{1,}}/g, paddedNumber) // {####}
    .replace(/{NUMBER}/g, paddedNumber); // {NUMBER}

  return result;
};

/**
 * Validate invoice number format
 * @param {String} format - Format string to validate
 * @returns {Object} { valid: Boolean, error: String }
 */
const validateFormat = (format) => {
  if (!format || typeof format !== 'string') {
    return { valid: false, error: 'Format must be a non-empty string' };
  }

  // Check if format contains a number placeholder
  const hasNumberPlaceholder = /{\#{1,}}|{NUMBER}/.test(format);
  if (!hasNumberPlaceholder) {
    return { valid: false, error: 'Format must contain a number placeholder (e.g., {####} or {NUMBER})' };
  }

  // Check for valid placeholders only
  const validPlaceholders = ['{YYYY}', '{YY}', '{MM}', '{DD}', '{PREFIX}', '{SUFFIX}', '{NUMBER}'];
  const placeholderRegex = /{[^}]+}/g;
  const placeholders = format.match(placeholderRegex) || [];
  
  for (const placeholder of placeholders) {
    // Allow #### patterns
    if (/^\{\#{1,}\}$/.test(placeholder)) {
      continue;
    }
    // Check if it's a valid placeholder
    if (!validPlaceholders.includes(placeholder)) {
      return { valid: false, error: `Invalid placeholder: ${placeholder}. Valid placeholders are: ${validPlaceholders.join(', ')}, or {####}` };
    }
  }

  return { valid: true };
};

/**
 * Get next number preview without incrementing
 * @param {ObjectId} organizationId - Organization ID
 * @param {String} type - 'invoice' or 'estimate'
 * @returns {String} Preview of next number
 */
const previewNextNumber = async (organizationId, type = 'invoice') => {
  const settings = await InvoiceSettings.findOne({ organization: organizationId });
  
  const config = type === 'invoice' 
    ? settings?.invoiceNumbering 
    : settings?.estimateNumbering;

  if (!config) {
    return type === 'invoice' ? 'INV-2025-0001' : 'EST-2025-0001';
  }

  // Check if we need to account for yearly reset
  const currentYear = new Date().getFullYear();
  const nextNumber = config.resetYearly && config.lastResetYear !== currentYear 
    ? 1 
    : config.nextNumber;

  return parseFormat(config.format, {
    number: nextNumber,
    padding: config.padding,
    prefix: config.prefix,
    suffix: config.suffix
  });
};

module.exports = {
  generateInvoiceNumber,
  parseFormat,
  validateFormat,
  previewNextNumber
};

