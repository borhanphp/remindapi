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
const { protect } = require('../middleware/auth'); // Assuming named export 'protect'

router.route('/invoices')
    .post(protect, createInvoice)
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
    .post(protect, sendManualReminder);

router.route('/stats')
    .get(protect, getDashboardStats);

module.exports = router;
