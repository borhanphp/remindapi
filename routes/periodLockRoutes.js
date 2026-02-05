const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/organization');
const ctrl = require('../controllers/periodLockController');

router.use(protect, requireOrganization);
router.get('/', ctrl.listLocks);
router.post('/', ctrl.upsertLock);

module.exports = router;


