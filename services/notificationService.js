const Notification = require('../models/Notification');
const User = require('../models/User');

class NotificationService {
  /**
   * Create a notification
   * @param {Object} data - Notification data
   * @returns {Promise<Notification>}
   */
  static async createNotification(data) {
    return await Notification.createNotification(data);
  }

  /**
   * Get notifications for a user
   * @param {String} organizationId
   * @param {String} userId
   * @param {Object} options - Query options (limit, page, read, type)
   * @returns {Promise<Object>}
   */
  static async getUserNotifications(organizationId, userId, options = {}) {
    const {
      limit = 50,
      page = 1,
      read,
      type,
      priority,
    } = options;

    const query = {
      organization: organizationId,
      recipient: userId,
    };

    if (read !== undefined) {
      query.read = read === 'true' || read === true;
    }

    if (type) {
      query.type = type;
    }

    if (priority) {
      query.priority = priority;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .populate('actor', 'name email avatar')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip),
      Notification.countDocuments(query),
    ]);

    return {
      notifications,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    };
  }

  /**
   * Mark notification as read
   * @param {String} organizationId
   * @param {String} userId
   * @param {String} notificationId
   * @returns {Promise<Notification>}
   */
  static async markAsRead(organizationId, userId, notificationId) {
    const notification = await Notification.findOne({
      _id: notificationId,
      organization: organizationId,
      recipient: userId,
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    return await notification.markAsRead();
  }

  /**
   * Mark all notifications as read for a user
   * @param {String} organizationId
   * @param {String} userId
   * @returns {Promise<Object>}
   */
  static async markAllAsRead(organizationId, userId) {
    return await Notification.markAllAsRead(organizationId, userId);
  }

  /**
   * Get unread count for a user
   * @param {String} organizationId
   * @param {String} userId
   * @returns {Promise<Number>}
   */
  static async getUnreadCount(organizationId, userId) {
    return await Notification.getUnreadCount(organizationId, userId);
  }

  /**
   * Delete notification
   * @param {String} organizationId
   * @param {String} userId
   * @param {String} notificationId
   * @returns {Promise<void>}
   */
  static async deleteNotification(organizationId, userId, notificationId) {
    const notification = await Notification.findOne({
      _id: notificationId,
      organization: organizationId,
      recipient: userId,
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    await notification.deleteOne();
  }

  /**
   * Create task assigned notification
   * @param {Object} params
   */
  static async notifyTaskAssigned(params) {
    const { task, assignee, assigner, organizationId } = params;

    if (!assignee || assignee.toString() === assigner._id.toString()) {
      return; // Don't notify if self-assigned
    }

    return await this.createNotification({
      organization: organizationId,
      recipient: assignee,
      type: 'task_assigned',
      title: 'New task assigned to you',
      message: `${assigner.name || assigner.email} assigned you "${task.title}"`,
      relatedEntityType: 'task',
      relatedEntityId: task._id,
      actionUrl: `/projects/tasks/${task._id}`,
      actor: assigner._id,
      priority: task.priority === 'urgent' ? 'high' : 'normal',
      metadata: {
        taskTitle: task.title,
        taskPriority: task.priority,
        projectId: task.project,
      },
    });
  }

  /**
   * Create task due soon notification
   * @param {Object} params
   */
  static async notifyTaskDueSoon(params) {
    const { task, organizationId, daysUntilDue } = params;

    if (!task.assigneeId) return;

    return await this.createNotification({
      organization: organizationId,
      recipient: task.assigneeId,
      type: 'task_due_soon',
      title: 'Task due soon',
      message: `"${task.title}" is due in ${daysUntilDue} ${daysUntilDue === 1 ? 'day' : 'days'}`,
      relatedEntityType: 'task',
      relatedEntityId: task._id,
      actionUrl: `/projects/tasks/${task._id}`,
      priority: daysUntilDue <= 1 ? 'high' : 'normal',
      metadata: {
        taskTitle: task.title,
        dueDate: task.dueDate,
        daysUntilDue,
      },
    });
  }

  /**
   * Create task overdue notification
   * @param {Object} params
   */
  static async notifyTaskOverdue(params) {
    const { task, organizationId } = params;

    if (!task.assigneeId) return;

    return await this.createNotification({
      organization: organizationId,
      recipient: task.assigneeId,
      type: 'task_overdue',
      title: 'Task overdue',
      message: `"${task.title}" is overdue`,
      relatedEntityType: 'task',
      relatedEntityId: task._id,
      actionUrl: `/projects/tasks/${task._id}`,
      priority: 'urgent',
      metadata: {
        taskTitle: task.title,
        dueDate: task.dueDate,
      },
    });
  }

  /**
   * Create task completed notification
   * @param {Object} params
   */
  static async notifyTaskCompleted(params) {
    const { task, completedBy, organizationId, watchers } = params;

    const notifications = [];

    // Notify task creator if not the one who completed it
    if (task.createdBy && task.createdBy.toString() !== completedBy._id.toString()) {
      notifications.push(
        this.createNotification({
          organization: organizationId,
          recipient: task.createdBy,
          type: 'task_completed',
          title: 'Task completed',
          message: `${completedBy.name || completedBy.email} completed "${task.title}"`,
          relatedEntityType: 'task',
          relatedEntityId: task._id,
          actionUrl: `/projects/tasks/${task._id}`,
          actor: completedBy._id,
        })
      );
    }

    // Notify watchers
    if (watchers && watchers.length > 0) {
      for (const watcherId of watchers) {
        if (watcherId.toString() !== completedBy._id.toString() && 
            watcherId.toString() !== task.createdBy?.toString()) {
          notifications.push(
            this.createNotification({
              organization: organizationId,
              recipient: watcherId,
              type: 'task_completed',
              title: 'Watched task completed',
              message: `${completedBy.name || completedBy.email} completed "${task.title}"`,
              relatedEntityType: 'task',
              relatedEntityId: task._id,
              actionUrl: `/projects/tasks/${task._id}`,
              actor: completedBy._id,
            })
          );
        }
      }
    }

    return await Promise.all(notifications);
  }

  /**
   * Create task blocked notification
   * @param {Object} params
   */
  static async notifyTaskBlocked(params) {
    const { task, blocker, organizationId } = params;

    if (!task.assigneeId) return;

    return await this.createNotification({
      organization: organizationId,
      recipient: task.assigneeId,
      type: 'task_blocked',
      title: 'Task blocked',
      message: `"${task.title}" is blocked${blocker ? ` by "${blocker.title}"` : ''}`,
      relatedEntityType: 'task',
      relatedEntityId: task._id,
      actionUrl: `/projects/tasks/${task._id}`,
      priority: 'high',
      metadata: {
        taskTitle: task.title,
        blockerId: blocker?._id,
        blockerTitle: blocker?.title,
      },
    });
  }

  /**
   * Create sprint started notification
   * @param {Object} params
   */
  static async notifySprintStarted(params) {
    const { sprint, teamMembers, organizationId, startedBy } = params;

    const notifications = [];

    for (const memberId of teamMembers) {
      if (memberId.toString() !== startedBy._id.toString()) {
        notifications.push(
          this.createNotification({
            organization: organizationId,
            recipient: memberId,
            type: 'sprint_started',
            title: 'Sprint started',
            message: `Sprint "${sprint.name}" has been started`,
            relatedEntityType: 'sprint',
            relatedEntityId: sprint._id,
            actionUrl: `/projects/sprints/${sprint._id}`,
            actor: startedBy._id,
          })
        );
      }
    }

    return await Promise.all(notifications);
  }

  /**
   * Create sprint ending soon notification
   * @param {Object} params
   */
  static async notifySprintEndingSoon(params) {
    const { sprint, teamMembers, organizationId, daysRemaining } = params;

    const notifications = [];

    for (const memberId of teamMembers) {
      notifications.push(
        this.createNotification({
          organization: organizationId,
          recipient: memberId,
          type: 'sprint_ending_soon',
          title: 'Sprint ending soon',
          message: `Sprint "${sprint.name}" ends in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}`,
          relatedEntityType: 'sprint',
          relatedEntityId: sprint._id,
          actionUrl: `/projects/sprints/${sprint._id}`,
          priority: daysRemaining <= 1 ? 'high' : 'normal',
        })
      );
    }

    return await Promise.all(notifications);
  }

  /**
   * Batch create notifications
   * @param {Array} notificationsData
   * @returns {Promise<Array>}
   */
  static async batchCreateNotifications(notificationsData) {
    const notifications = [];

    for (const data of notificationsData) {
      try {
        const notification = await this.createNotification(data);
        notifications.push(notification);
      } catch (error) {
        console.error('Error creating notification:', error);
      }
    }

    return notifications;
  }

  /**
   * Clean up old notifications
   * @param {Number} daysOld - Delete notifications older than this many days
   * @returns {Promise<Number>}
   */
  static async cleanupOldNotifications(daysOld = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await Notification.deleteMany({
      createdAt: { $lt: cutoffDate },
      read: true,
    });

    return result.deletedCount;
  }
}

module.exports = NotificationService;

