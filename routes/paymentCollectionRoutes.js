const express = require('express');
const router = express.Router();
const {
  createCheckoutSession,
  stripeWebhook,
  getPaymentConfig,
  createPaypalOrder,
  capturePaypalOrder,
} = require('../controllers/paymentCollectionController');

router.post('/stripe/webhook', stripeWebhook);
router.get('/:token/config', getPaymentConfig);
router.post('/:token/checkout', createCheckoutSession);
router.post('/:token/paypal/order', createPaypalOrder);
router.post('/:token/paypal/capture', capturePaypalOrder);

module.exports = router;
