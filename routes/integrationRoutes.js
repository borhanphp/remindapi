const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/integrationController');

// Apply authentication middleware
router.use(protect);

// Integration status
router.get('/status', ctrl.getIntegrationStatus);

// Initialize accounting module
router.post('/initialize-accounting', ctrl.initializeAccounting);

// Sync inventory to accounting
router.post('/sync-inventory', ctrl.syncInventoryToAccounting);

// Test integration (development only)
router.post('/test', ctrl.testIntegration);

// Webhook endpoints (secured behind auth for now; can be made public with verification later)
router.post('/webhooks/gmail', ctrl.gmailWebhook);
router.post('/webhooks/twilio', ctrl.twilioWebhook);
router.post('/webhooks/calendar', ctrl.calendarWebhook);

module.exports = router; 