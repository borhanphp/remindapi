const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  getWebhookLogs,
  testWebhook
} = require('../controllers/webhookController');

router.use(protect);

router.get('/', listWebhooks);
router.post('/', createWebhook);
router.put('/:id', updateWebhook);
router.delete('/:id', deleteWebhook);
router.get('/:id/logs', getWebhookLogs);
router.post('/:id/test', testWebhook);

module.exports = router;
