const express = require('express');
const router = express.Router();
const {
  createCheckoutSession,
  stripeWebhook,
  getPaymentConfig,
} = require('../controllers/paymentCollectionController');

router.get('/:token/config', getPaymentConfig);
router.post('/:token/checkout', createCheckoutSession);
router.post('/stripe/webhook', stripeWebhook);

module.exports = router;
