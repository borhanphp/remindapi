const express = require('express');
const router = express.Router();
const {
  getPackingTasks,
  getPackingTask,
  createPackingTask,
  addBox,
  markAsPacked,
  markAsShipped,
  generateBoxShippingLabel,
  generateAllShippingLabels
} = require('../controllers/packingController');

const { protect, authorize } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/organization');
const { PERMISSIONS } = require('../utils/permissions');

// Apply authentication and organization middleware to all routes
router.use(protect);
router.use(requireOrganization);

// CRUD operations
router.route('/')
  .get(authorize(PERMISSIONS.INVENTORY_VIEW), getPackingTasks)
  .post(authorize(PERMISSIONS.INVENTORY_CREATE), createPackingTask);

router.route('/:id')
  .get(authorize(PERMISSIONS.INVENTORY_VIEW), getPackingTask);

// Packing actions
router.post('/:id/boxes', authorize(PERMISSIONS.INVENTORY_EDIT), addBox);
router.put('/:id/packed', authorize(PERMISSIONS.INVENTORY_EDIT), markAsPacked);
router.put('/:id/shipped', authorize(PERMISSIONS.INVENTORY_EDIT), markAsShipped);

// Shipping labels
router.get('/:id/shipping-labels', authorize(PERMISSIONS.INVENTORY_VIEW), generateAllShippingLabels);
router.get('/:id/boxes/:boxId/shipping-label', authorize(PERMISSIONS.INVENTORY_VIEW), generateBoxShippingLabel);

module.exports = router;

