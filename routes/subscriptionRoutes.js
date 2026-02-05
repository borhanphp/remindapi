const express = require('express');
const router = express.Router();
const {
    getStatus,
    getPlans,
    getBillingHistory,
    getUsage,
    previewUpgrade,
    checkFeature
} = require('../controllers/subscriptionController');
const { protect } = require('../middleware/auth');

// Public routes
router.get('/plans', getPlans);

// Protected routes
router.use(protect);

router.get('/status', getStatus);
router.get('/billing-history', getBillingHistory);
router.get('/usage', getUsage);
router.get('/preview-upgrade', previewUpgrade);
router.get('/check-feature/:featureName', checkFeature);

module.exports = router;
