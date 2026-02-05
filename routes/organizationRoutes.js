const express = require('express');
const router = express.Router();
const {
  createOrganization,
  getOrganization,
  updateOrganization,
  updateSubscription,
  cancelSubscription,
  getAllOrganizationsAdmin,
  getOrganizationByIdAdmin,
  updateOrganizationByIdAdmin,
  updateOrganizationOwnerCredentialsAdmin,
  cancelOrganizationSubscriptionAdmin,
  updateOrganizationModules
} = require('../controllers/organizationController');
const { protect, requirePlatformAdmin } = require('../middleware/auth');
const { setOrganizationContext, checkRole } = require('../middleware/organization');

// Public routes
router.post('/', createOrganization);

// Protected routes
router.use(protect);

// Platform admin routes (no org context)
router.get('/admin', requirePlatformAdmin, getAllOrganizationsAdmin);
router.get('/admin/:id', requirePlatformAdmin, getOrganizationByIdAdmin);
router.put('/admin/:id', requirePlatformAdmin, updateOrganizationByIdAdmin);
router.put('/admin/:id/owner-credentials', requirePlatformAdmin, updateOrganizationOwnerCredentialsAdmin);
router.put('/admin/:id/cancel-subscription', requirePlatformAdmin, cancelOrganizationSubscriptionAdmin);
router.put('/admin/:id/modules', requirePlatformAdmin, updateOrganizationModules);

// Tenant-scoped routes
router.use(setOrganizationContext);

router.get('/me', getOrganization);
router.put('/me', checkRole('owner', 'admin'), updateOrganization);
router.put('/subscription', checkRole('owner'), updateSubscription);
router.delete('/subscription', checkRole('owner'), cancelSubscription);

module.exports = router; 