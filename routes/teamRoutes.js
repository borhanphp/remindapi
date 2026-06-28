const express = require('express');
const router = express.Router();
const { getTeamMembers, inviteMember, removeMember, cancelInvite } = require('../controllers/teamController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
    .get(getTeamMembers);

router.route('/invite')
    .post(inviteMember);

router.route('/members/:memberId')
    .delete(removeMember);

router.route('/invites/:userId')
    .delete(cancelInvite);

module.exports = router;
