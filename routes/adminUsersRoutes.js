const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const OrganizationMembership = require('../models/OrganizationMembership');

// Middleware to check if user is super admin
const requireSuperAdmin = (req, res, next) => {
    if (!req.user.isSuperAdmin) {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Super admin privileges required.'
        });
    }
    next();
};

// All routes require super admin authentication
router.use(protect, requireSuperAdmin);

/**
 * @desc    Get all users across all organizations
 * @route   GET /api/admin/users
 * @access  Private/SuperAdmin
 */
router.get('/', async (req, res) => {
    try {
        const { search, page = 1, limit = 20 } = req.query;

        const filter = { isSuperAdmin: { $ne: true } }; // Exclude super admins
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const total = await User.countDocuments(filter);
        const users = await User.find(filter)
            .select('name email isActive isEmailVerified organization createdAt lastLogin')
            .populate('organization', 'name slug')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        res.json({
            success: true,
            data: users,
            meta: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
});

/**
 * @desc    Toggle user active status
 * @route   PUT /api/admin/users/:id/toggle-status
 * @access  Private/SuperAdmin
 */
router.put('/:id/toggle-status', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.isSuperAdmin) {
            return res.status(400).json({ success: false, message: 'Cannot modify super admin status' });
        }

        user.isActive = !user.isActive;
        await user.save();

        res.json({
            success: true,
            message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
            data: user
        });
    } catch (error) {
        console.error('Toggle user status error:', error);
        res.status(500).json({ success: false, message: 'Failed to update user status' });
    }
});

/**
 * @desc    Delete user
 * @route   DELETE /api/admin/users/:id
 * @access  Private/SuperAdmin
 */
router.delete('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.isSuperAdmin) {
            return res.status(400).json({ success: false, message: 'Cannot delete super admin' });
        }

        // Delete memberships
        await OrganizationMembership.deleteMany({ user: user._id });

        // Delete the user
        await User.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
});

module.exports = router;
