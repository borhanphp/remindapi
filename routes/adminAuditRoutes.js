const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');
const {
  getAuditLogs,
  getAuditSummary,
  createAuditLog
} = require('../controllers/adminAuditController');

// All routes require authentication and audit view permission
router.use(protect);
router.use(authorize(PERMISSIONS.AUDIT_VIEW));

// Get audit logs with filters
router.get('/log', getAuditLogs);

// Get audit summary/statistics
router.get('/summary', getAuditSummary);

// Create audit log (requires create permission)
router.post('/log', authorize(PERMISSIONS.AUDIT_CREATE), createAuditLog);

module.exports = router;

