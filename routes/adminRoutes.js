const express = require('express');
const router = express.Router();
const { protect, requirePlatformAdmin } = require('../middleware/auth');
const admin = require('../controllers/adminController');

// All admin routes require authentication + super admin
router.use(protect);
router.use(requirePlatformAdmin);

// Organizations
router.get('/organizations/stats', admin.getOrganizationStats);
router.get('/organizations', admin.getOrganizations);
router.get('/organizations/:id', admin.getOrganizationById);
router.put('/organizations/:id/approve', admin.approveOrganization);
router.put('/organizations/:id/reject', admin.rejectOrganization);
router.put('/organizations/:id/toggle-status', admin.toggleOrganizationStatus);
router.put('/organizations/:id/cancel-subscription', admin.cancelOrganizationSubscription);
router.delete('/organizations/:id', admin.deleteOrganization);

// Users
router.get('/users', admin.getUsers);
router.put('/users/:id/toggle-status', admin.toggleUserStatus);
router.delete('/users/:id', admin.deleteUser);

// Pricing
router.get('/pricing', admin.getPricing);
router.put('/pricing', admin.updatePricing);
router.get('/pricing/processor', admin.getProcessor);
router.put('/pricing/processor', admin.updateProcessor);

// Audit logs
router.get('/audit/log', admin.getAuditLogs);
router.get('/audit/summary', admin.getAuditSummary);

// Contact messages
router.get('/contacts', admin.getContacts);
router.put('/contacts/:id/read', admin.markContactRead);
router.put('/contacts/:id/resolve', admin.markContactResolved);
router.delete('/contacts/:id', admin.deleteContact);

module.exports = router;
