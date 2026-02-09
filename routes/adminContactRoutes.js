const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    getContactMessages,
    getUnreadCount,
    markAsRead,
    markAsResolved,
    deleteMessage
} = require('../controllers/contactController');

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

router.get('/', getContactMessages);
router.get('/unread-count', getUnreadCount);
router.put('/:id/read', markAsRead);
router.put('/:id/resolve', markAsResolved);
router.delete('/:id', deleteMessage);

module.exports = router;
