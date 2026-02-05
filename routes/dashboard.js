const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/organization');
const { getDashboardStats } = require('../controllers/dashboardController');

router.use(protect);
router.use(requireOrganization);

router.get('/stats', getDashboardStats);

module.exports = router;

