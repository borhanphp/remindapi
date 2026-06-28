const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  searchClients,
  syncClientStats,
} = require('../controllers/clientController');

router.use(protect);

router.get('/search', searchClients);
router.post('/sync', syncClientStats);
router.route('/').get(listClients).post(createClient);
router.route('/:id').get(getClient).put(updateClient).delete(deleteClient);

module.exports = router;
