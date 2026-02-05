const express = require('express');
const router = express.Router();
const {
  registerOrganization,
  verifyEmail,
  resendVerification,
  getPlans,
  getOnboardingStatus
} = require('../controllers/saasController');
const { protect } = require('../middleware/auth');

// Public routes
router.post('/register', registerOrganization);
router.get('/verify-email/:token', verifyEmail);
router.get('/plans', getPlans);

// Protected routes
router.use(protect);
router.post('/resend-verification', resendVerification);
router.get('/onboarding-status', getOnboardingStatus);

module.exports = router; 