const express = require('express');
const router = express.Router();
const { 
  getRoles, 
  getCustomRoles, 
  getRole, 
  createRole, 
  updateRole, 
  deleteRole,
  addPermissions,
  removePermissions
} = require('../controllers/roles');
const { protect, authorize } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');

// @desc    Get all roles (including custom roles)
// @route   GET /api/roles
// @access  Private/Admin
router.get('/', protect, authorize(PERMISSIONS.ROLES_VIEW), getRoles);

// @desc    Get custom roles only
// @route   GET /api/roles/custom
// @access  Private/Admin
router.get('/custom', protect, authorize(PERMISSIONS.ROLES_VIEW), getCustomRoles);

// @desc    Get single role
// @route   GET /api/roles/:id
// @access  Private/Admin
router.get('/:id', protect, authorize(PERMISSIONS.ROLES_VIEW), getRole);

// @desc    Create role
// @route   POST /api/roles
// @access  Private/Admin
router.post('/', protect, authorize(PERMISSIONS.ROLES_CREATE), createRole);

// @desc    Update role
// @route   PUT /api/roles/:id
// @access  Private/Admin
router.put('/:id', protect, authorize(PERMISSIONS.ROLES_EDIT), updateRole);

// @desc    Delete role
// @route   DELETE /api/roles/:id
// @access  Private/Admin
router.delete('/:id', protect, authorize(PERMISSIONS.ROLES_DELETE), deleteRole);

// @desc    Add/remove permissions on a role
// @route   POST /api/roles/:id/permissions/add
// @access  Private/Admin
router.post('/:id/permissions/add', protect, authorize(PERMISSIONS.ROLES_EDIT), addPermissions);
// @route   POST /api/roles/:id/permissions/remove
router.post('/:id/permissions/remove', protect, authorize(PERMISSIONS.ROLES_EDIT), removePermissions);

module.exports = router; 
