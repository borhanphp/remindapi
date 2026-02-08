const express = require('express');
const router = express.Router();
const {
    createInvoice,
    getInvoices,
    getDashboardStats,
    markAsPaid,
    updateInvoice,
    deleteInvoice,
    sendManualReminder,
    getInvoiceLogs,
    getInvoice
} = require('../controllers/InvoiceReminderController');
const { protect } = require('../middleware/auth');
const {
    invoiceApiRateLimit,
    invoiceCreateRateLimit,
    reminderRateLimit
} = require('../middleware/rateLimit');
const { sanitizeBody } = require('../utils/sanitize');

// Apply general rate limiting and input sanitization to all invoice routes
router.use(invoiceApiRateLimit);
router.use(sanitizeBody({ emailFields: ['clientEmail', 'email'] }));

router.route('/invoices')
    .post(protect, invoiceCreateRateLimit, createInvoice)
    .get(protect, getInvoices);

router.route('/invoices/:id')
    .get(protect, getInvoice)
    .put(protect, updateInvoice)
    .delete(protect, deleteInvoice);

router.route('/invoices/:id/logs')
    .get(protect, getInvoiceLogs);

router.route('/invoices/:id/pay')
    .put(protect, markAsPaid);

router.route('/invoices/:id/remind')
    .post(protect, reminderRateLimit, sendManualReminder);

router.route('/stats')
    .get(protect, getDashboardStats);

module.exports = router;

