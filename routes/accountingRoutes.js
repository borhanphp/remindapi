const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getConnections,
  connectQuickBooks,
  quickbooksCallback,
  connectXero,
  xeroCallback,
  syncInvoices,
  disconnect
} = require('../controllers/accountingController');

router.get('/connections', protect, getConnections);

router.post('/quickbooks/connect', protect, connectQuickBooks);
router.get('/quickbooks/callback', quickbooksCallback);

router.post('/xero/connect', protect, connectXero);
router.get('/xero/callback', xeroCallback);

router.post('/sync/:provider', protect, syncInvoices);
router.delete('/disconnect/:provider', protect, disconnect);

module.exports = router;
