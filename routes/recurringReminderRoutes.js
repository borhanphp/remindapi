const express = require('express');
const router = express.Router();
const { create, getAll, getOne, update, remove } = require('../controllers/recurringReminderController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
    .post(create)
    .get(getAll);

router.route('/:id')
    .get(getOne)
    .put(update)
    .delete(remove);

module.exports = router;
