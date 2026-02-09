const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getAllOrganizations,
  getOrganizationDetails,
  approveOrganization,
  rejectOrganization,
  getApprovalStats,
  toggleOrganizationStatus,
  deleteOrganization,
  cancelSubscription
} = require('../controllers/organizationApprovalController');

// Middleware to check if user is super admin
const requireSuperAdmin = (req, res, next) => {
  if (!req.user.isSuperAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Super admin privileges required.'
    });
  }
  next();
};

// All routes require authentication and super admin access
router.use(protect, requireSuperAdmin);

// Get statistics
router.get('/stats', getApprovalStats);

// Get all organizations
router.get('/', getAllOrganizations);

// Get organization details
router.get('/:id', getOrganizationDetails);

// Approve organization
router.put('/:id/approve', approveOrganization);

// Reject organization
router.put('/:id/reject', rejectOrganization);

// Toggle organization active status
router.put('/:id/toggle-status', toggleOrganizationStatus);

// Cancel organization subscription
router.put('/:id/cancel-subscription', cancelSubscription);

// Delete organization
router.delete('/:id', deleteOrganization);

module.exports = router;

