const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/organization');
const { PERMISSIONS } = require('../utils/permissions');
const ctrl = require('../controllers/permissionController');

router.use(protect, requireOrganization, authorize(PERMISSIONS.ROLES_VIEW));

router.get('/registry', ctrl.getRegistry);
router.get('/roles-diff', ctrl.getRolesDiff);

module.exports = router;

