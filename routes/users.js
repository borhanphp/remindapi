const express = require('express');
const router = express.Router();
const { 
  getUsers, 
  getUser, 
  createUser, 
  updateUser, 
  deleteUser,
  toggleUserStatus,
  assignRole,
  getUserPermissions
} = require('../controllers/users');
const { protect, authorize } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/organization');
const { PERMISSIONS } = require('../utils/permissions');

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
router.get('/', protect, requireOrganization, authorize(PERMISSIONS.USERS_VIEW), getUsers);

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/Admin
router.get('/:id', protect, requireOrganization, authorize(PERMISSIONS.USERS_VIEW), getUser);

// @desc    Create user
// @route   POST /api/users
// @access  Private/Admin
router.post('/', protect, requireOrganization, authorize(PERMISSIONS.USERS_CREATE), createUser);

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
router.put('/:id', protect, requireOrganization, authorize(PERMISSIONS.USERS_EDIT), updateUser);

// @desc    Assign role to user
// @route   PUT /api/users/:id/role
// @access  Private/Admin
router.put('/:id/role', protect, requireOrganization, authorize(PERMISSIONS.USERS_EDIT), assignRole);

// @desc    Get user permissions
// @route   GET /api/users/:id/permissions
// @access  Private/Admin
router.get('/:id/permissions', protect, requireOrganization, authorize(PERMISSIONS.USERS_VIEW), getUserPermissions);

// @desc    Toggle user active status
// @route   PUT /api/users/:id/toggle-status
// @access  Private/Admin
router.put('/:id/toggle-status', protect, requireOrganization, authorize(PERMISSIONS.USERS_EDIT), toggleUserStatus);

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
router.delete('/:id', protect, requireOrganization, authorize(PERMISSIONS.USERS_DELETE), deleteUser);

module.exports = router; 