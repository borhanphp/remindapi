const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/organization');
const ctrl = require('../controllers/profileController');

router.use(protect);
router.get('/', ctrl.getProfile);
router.put('/', ctrl.updateProfile);
router.put('/change-password', ctrl.changePassword);
router.get('/organization', requireOrganization, ctrl.getOrganization);
router.put('/organization', requireOrganization, ctrl.updateOrganization);

module.exports = router;



