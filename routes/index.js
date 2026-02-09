// Placeholder to avoid empty directory issues if referenced elsewhere
module.exports = {};

const express = require('express');
const router = express.Router();

// Import route files
const auth = require('./auth');
const saas = require('./saasRoutes');
const organizations = require('./organizationRoutes');
const users = require('./users');
const roles = require('./roles');
const suppliers = require('./suppliers');
const customers = require('./customers');
const products = require('./products');
const categories = require('./categories');
const warehouses = require('./warehouses');
const purchaseOrders = require('./purchaseOrders');
const purchaseReceipts = require('./purchaseReceipts');
const purchaseReports = require('./purchaseReports');
const accountsReceivable = require('./accountsReceivableRoutes');
const batchSerial = require('./batchSerial');
const cycleCount = require('./cycleCount');
const inventoryReports = require('./inventoryReports');
const marketing = require('./marketingRoutes');
const notifications = require('./notificationRoutes');
const reporting = require('./reportingRoutes');
const contact = require('./contactRoutes');

// Mount routes
router.use('/auth', auth);
router.use('/contact', contact);
router.use('/saas', saas);
router.use('/marketing', marketing);
router.use('/organizations', organizations);
router.use('/users', users);
router.use('/roles', roles);
router.use('/suppliers', suppliers);
router.use('/customers', customers);
router.use('/products', products);
router.use('/categories', categories);
router.use('/warehouses', warehouses);
router.use('/purchase-orders', purchaseOrders);
router.use('/purchase-receipts', purchaseReceipts);
router.use('/purchase-reports', purchaseReports);
router.use('/accounts-receivable', accountsReceivable);
router.use('/batch-serial', batchSerial);
router.use('/cycle-counts', cycleCount);
router.use('/inventory-reports', inventoryReports);
router.use('/notifications', notifications);
router.use('/reports', reporting);

module.exports = router; 