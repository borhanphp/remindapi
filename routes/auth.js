const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  testEmail,
  verifyEmail,
  resendVerification,
  selectOrganization,
  getMyOrganizations,
  switchOrganization,
  updatePassword,
  updateDetails
} = require('../controllers/auth');
const { protect, requirePlatformAdmin } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');
const {
  loginRateLimit,
  registrationRateLimit,
  passwordResetRateLimit,
  verificationRateLimit
} = require('../middleware/rateLimit');

// Register user - Rate limited: 10 attempts per hour
router.post('/register', registrationRateLimit, register);

// Login user - Rate limited: 5 attempts per 15 minutes
router.post('/login', loginRateLimit, login);

// Email verification
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', verificationRateLimit, resendVerification);

// Organization selection and switching
router.post('/select-organization', selectOrganization);
router.get('/my-organizations', protect, getMyOrganizations);
router.post('/switch-organization', protect, switchOrganization);

// Get current user
router.get('/me', protect, getMe);

// Forgot password - Rate limited: 3 attempts per hour
router.post('/forgotpassword', passwordResetRateLimit, forgotPassword);

// Reset password
// Reset password
router.put('/resetpassword/:resettoken', resetPassword);

// Update password (authenticated)
router.put('/updatepassword', protect, updatePassword);

// Update user details (authenticated)
router.put('/updatedetails', protect, updateDetails);

// ============================================
// DEVELOPMENT-ONLY ENDPOINTS
// These are only accessible in development mode
// ============================================

// Test email - DEVELOPMENT ONLY
if (process.env.NODE_ENV === 'development') {
  router.get('/test-email', protect, requirePlatformAdmin, testEmail);

  // Debug endpoint to check user permissions - DEVELOPMENT ONLY
  router.get('/debug-permissions', protect, requirePlatformAdmin, async (req, res) => {
    try {
      const roleObj = req.user.role && typeof req.user.role === 'object' ? req.user.role : null;
      const userRoleName = (roleObj ? roleObj.name : req.user.legacyRole) || (typeof req.user.role === 'string' ? req.user.role : null);
      const userId = req.user._id;
      const userName = req.user.name;

      const Role = require('../models/Role');
      const role = roleObj || (userRoleName ? await Role.findOne({ name: userRoleName, organization: req.user.organization }) : null);

      res.json({
        success: true,
        message: 'User debug info',
        user: {
          id: userId,
          name: userName,
          role: userRoleName
        },
        roleInfo: role ? {
          name: role.name,
          permissionCount: role.permissions.length
        } : {
          error: 'Role not found in database'
        }
      });
    } catch (error) {
      console.error('Debug permissions error:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking permissions'
      });
    }
  });
}

module.exports = router;

