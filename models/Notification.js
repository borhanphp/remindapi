const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: [
      'task_assigned',
      'task_updated',
      'task_completed',
      'task_commented',
      'task_mentioned',
      'task_due_soon',
      'task_overdue',
      'task_blocked',
      'task_unblocked',
      'sprint_started',
      'sprint_completed',
      'sprint_ending_soon',
      'project_updated',
      'project_member_added',
      'milestone_due_soon',
      'milestone_completed',
      'approval_requested',
      'approval_approved',
      'approval_rejected',
      'comment_reply',
      'mention',
      'system',
    ],
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  // Related entity
  relatedEntityType: {
    type: String,
    enum: ['task', 'project', 'sprint', 'milestone', 'comment', 'approval'],
  },
  relatedEntityId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true,
  },
  // Action URL to navigate to
  actionUrl: {
    type: String,
  },
  // Actor who triggered the notification
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  // Metadata for additional context
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
  // Read status
  read: {
    type: Boolean,
    default: false,
    index: true,
  },
  readAt: {
    type: Date,
  },
  // Email sent status
  emailSent: {
    type: Boolean,
    default: false,
  },
  emailSentAt: {
    type: Date,
  },
  // Push notification sent status
  pushSent: {
    type: Boolean,
    default: false,
  },
  pushSentAt: {
    type: Date,
  },
  // Priority
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
  },
  // Expiry (auto-delete after certain period)
  expiresAt: {
    type: Date,
    index: true,
  },
}, {
  timestamps: true,
});

// Compound indexes for efficient queries
NotificationSchema.index({ organization: 1, recipient: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ organization: 1, recipient: 1, type: 1, read: 1 });
NotificationSchema.index({ relatedEntityType: 1, relatedEntityId: 1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Static method to create notification
NotificationSchema.statics.createNotification = async function(data) {
  const notification = new this(data);
  
  // Set expiry if not provided (default 90 days)
  if (!notification.expiresAt) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 90);
    notification.expiresAt = expiryDate;
  }
  
  await notification.save();
  
  // TODO: Integrate with WebSocket for real-time delivery
  // TODO: Integrate with email service if user has email notifications enabled
  
  return notification;
};

// Method to mark as read
NotificationSchema.methods.markAsRead = function() {
  this.read = true;
  this.readAt = new Date();
  return this.save();
};

// Static method to mark all as read for a user
NotificationSchema.statics.markAllAsRead = async function(organizationId, userId) {
  return this.updateMany(
    {
      organization: organizationId,
      recipient: userId,
      read: false,
    },
    {
      $set: {
        read: true,
        readAt: new Date(),
      },
    }
  );
};

// Static method to get unread count
NotificationSchema.statics.getUnreadCount = async function(organizationId, userId) {
  return this.countDocuments({
    organization: organizationId,
    recipient: userId,
    read: false,
  });
};

module.exports = mongoose.model('Notification', NotificationSchema);

