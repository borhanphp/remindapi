const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/organization');
const { listFx, upsertFx } = require('../controllers/fxController');

router.use(protect, requireOrganization);
router.get('/', listFx);
router.post('/', upsertFx);

module.exports = router;


