const express = require('express');
const router = express.Router();
const { handleWebhook } = require('../controllers/polarController');

// Polar webhook endpoint (public, signature verified in controller)
router.post('/webhook', express.json(), handleWebhook);

module.exports = router;
