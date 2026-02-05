const mongoose = require('mongoose');

/**
 * Validates if a string is a valid MongoDB ObjectId
 * @param {string} id - The ID to validate
 * @returns {boolean} - True if valid, false otherwise
 */
exports.validateObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Validates if a string is not empty
 * @param {string} str - The string to validate
 * @returns {boolean} - True if valid, false otherwise
 */
exports.validateRequired = (str) => {
  return str && str.trim().length > 0;
};

/**
 * Validates if a number is positive
 * @param {number} num - The number to validate
 * @returns {boolean} - True if valid, false otherwise
 */
exports.validatePositiveNumber = (num) => {
  return typeof num === 'number' && num > 0;
};

/**
 * Validates if a date string is valid and not in the past
 * @param {string} dateStr - The date string to validate
 * @returns {boolean} - True if valid, false otherwise
 */
exports.validateFutureDate = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  return date instanceof Date && !isNaN(date) && date >= now;
};

/**
 * Validates an email address
 * @param {string} email - The email to validate
 * @returns {boolean} - True if valid, false otherwise
 */
exports.validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates a phone number
 * @param {string} phone - The phone number to validate
 * @returns {boolean} - True if valid, false otherwise
 */
exports.validatePhone = (phone) => {
  const phoneRegex = /^\+?[\d\s-]{10,}$/;
  return phoneRegex.test(phone);
};

/**
 * Validates if an array is not empty
 * @param {Array} arr - The array to validate
 * @returns {boolean} - True if valid, false otherwise
 */
exports.validateNonEmptyArray = (arr) => {
  return Array.isArray(arr) && arr.length > 0;
};

/**
 * Validates if a value is within an enum
 * @param {*} value - The value to validate
 * @param {Array} enumValues - The allowed enum values
 * @returns {boolean} - True if valid, false otherwise
 */
exports.validateEnum = (value, enumValues) => {
  return enumValues.includes(value);
}; 