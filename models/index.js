const mongoose = require('mongoose');
const { isModuleEnabled } = require('../config/modules');

// Core models (always imported)
const User = require('./User');
const Organization = require('./Organization');
const OrganizationMembership = require('./OrganizationMembership');
const Role = require('./Role');

// Inventory models (conditionally imported)
let inventoryModels = {};


// Accounting models (conditionally imported)
let accountingModels = {};


// CRM models (conditionally imported)
let crmModels = {};


// HRM models (conditionally imported)
let hrmModels = {};


// Projects models (always imported to avoid runtime undefined when module toggled)


// Accounts Payable models (can work with or without accounting module)
const apModels = {
  VendorBill: require('./VendorBill'),
  VendorPayment: require('./VendorPayment'),
  PaymentSchedule: require('./PaymentSchedule')
};

// Custom Invoicing models (conditionally imported)
let customInvoicingModels = {};


// Export all models
module.exports = {
  // Core models
  User,
  Organization,
  OrganizationMembership,
  Role,
}; 
