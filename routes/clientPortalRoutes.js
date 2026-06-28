const express = require('express');
const router = express.Router();
const {
    getInvoiceForClient,
    markClientPaid
} = require('../controllers/clientPortalController');

router.get('/:token', getInvoiceForClient);
router.post('/:token/paid', markClientPaid);

module.exports = router;
