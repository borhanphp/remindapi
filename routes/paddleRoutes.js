const express = require('express');
const router = express.Router();
const {
    createCheckout,
    handleWebhook,
    testWebhook,
    getSubscription,
    cancelSubscription,
    updateSubscription,
    getTransactions,
    getPortalUrl,
    getPlans
} = require('../controllers/paddleController');
const { protect } = require('../middleware/auth');

// Public routes
router.get('/plans', getPlans);

// Webhook endpoint (public, but signature verified in controller)
// Note: Raw body parsing is handled in server.js for this route
router.post('/webhook', handleWebhook);
router.get('/webhook', testWebhook);

// Protected routes
router.use(protect);
router.post('/checkout', createCheckout);
router.get('/subscription', getSubscription);
router.post('/cancel', cancelSubscription);
router.post('/update', updateSubscription);
router.get('/transactions', getTransactions);
router.get('/portal-url', getPortalUrl);

module.exports = router;
