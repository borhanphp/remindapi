const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/organization');
const asyncHandler = require('../middleware/async');
const NotificationService = require('../services/notificationService');

router.use(protect, requireOrganization);

/**
 * @desc    Get user notifications
 * @route   GET /api/notifications
 * @access  Private
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const userOrgId = req.user.organization._id || req.user.organization;
    const userId = req.user._id;

    const result = await NotificationService.getUserNotifications(
      userOrgId,
      userId,
      req.query
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  })
);

/**
 * @desc    Get unread count
 * @route   GET /api/notifications/unread-count
 * @access  Private
 */
router.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const userOrgId = req.user.organization._id || req.user.organization;
    const userId = req.user._id;

    const count = await NotificationService.getUnreadCount(userOrgId, userId);

    res.status(200).json({
      success: true,
      data: { count },
    });
  })
);

/**
 * @desc    Mark notification as read
 * @route   PUT /api/notifications/:id/read
 * @access  Private
 */
router.put(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const userOrgId = req.user.organization._id || req.user.organization;
    const userId = req.user._id;

    const notification = await NotificationService.markAsRead(
      userOrgId,
      userId,
      req.params.id
    );

    res.status(200).json({
      success: true,
      data: notification,
    });
  })
);

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/notifications/read-all
 * @access  Private
 */
router.put(
  '/read-all',
  asyncHandler(async (req, res) => {
    const userOrgId = req.user.organization._id || req.user.organization;
    const userId = req.user._id;

    const result = await NotificationService.markAllAsRead(userOrgId, userId);

    res.status(200).json({
      success: true,
      data: result,
    });
  })
);

/**
 * @desc    Delete notification
 * @route   DELETE /api/notifications/:id
 * @access  Private
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const userOrgId = req.user.organization._id || req.user.organization;
    const userId = req.user._id;

    await NotificationService.deleteNotification(
      userOrgId,
      userId,
      req.params.id
    );

    res.status(200).json({
      success: true,
      data: {},
    });
  })
);

module.exports = router;

