const express = require('express');
const router = express.Router();
const {
    createCheckout,
    getSubscription,
    cancelSubscription,
    getPortalUrl,
    getProcessor
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Get active processor
router.get('/processor', getProcessor);

// Checkout
router.post('/checkout', createCheckout);

// Subscription management
router.get('/subscription', getSubscription);
router.post('/cancel', cancelSubscription);
router.get('/portal-url', getPortalUrl);

module.exports = router;
