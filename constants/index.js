/**
 * This file re-exports permissions from the utils folder
 * to maintain backward compatibility with code importing from constants
 */

// Import and re-export permissions
const { PERMISSIONS } = require('../utils/permissions');

module.exports = {
  PERMISSIONS
}; 