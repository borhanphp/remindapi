const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/organization');
const ctrl = require('../controllers/fxRevaluationController');

router.use(protect, requireOrganization);
router.post('/run', ctrl.runRevaluation);

module.exports = router;


