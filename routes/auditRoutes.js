const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/organization');
const ctrl = require('../controllers/auditController');

router.use(protect, requireOrganization);
router.get('/', ctrl.listAuditLogs);

module.exports = router;


