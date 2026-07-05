const express = require('express');
const router = express.Router();
const {
    getInvoiceForClient,
    markClientPaid,
    unsubscribe
} = require('../controllers/clientPortalController');

router.get('/:token', getInvoiceForClient);
router.post('/:token/paid', markClientPaid);
router.post('/:token/unsubscribe', unsubscribe);

module.exports = router;
