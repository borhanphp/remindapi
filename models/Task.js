const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    // Project Management Enhancement: Link to project
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    // Start date for scheduling
    startDate: {
      type: Date,
      index: true,
    },
    dueDate: {
      type: Date,
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['backlog', 'todo', 'in-progress', 'blocked', 'done', 'pending', 'in_progress', 'completed', 'cancelled'],
      default: 'todo',
      index: true,
    },
    assigneeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    // Project Management Enhancement: Subtasks
    parentTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      index: true,
    },
    hierarchyLevel: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    // Project Management Enhancement: Dependencies
    dependsOn: [{
      task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
      type: { 
        type: String, 
        enum: ['finish-to-start', 'start-to-start', 'finish-to-finish', 'start-to-finish'], 
        default: 'finish-to-start' 
      },
      lag: { type: Number, default: 0 } // days
    }],
    blockedBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task'
    }],
    // Project Management Enhancement: Agile/Sprint
    storyPoints: {
      type: Number,
      min: 0,
      max: 100,
    },
    sprint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sprint',
      index: true,
    },
    // Project Management Enhancement: Labels and categorization
    labels: [{
      type: String,
      trim: true,
    }],
    tags: [{
      type: String,
      trim: true,
    }],
    // Project Management Enhancement: Watchers (users following this task)
    watchers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    // Project Management Enhancement: Attachments
    attachments: [{
      filename: { type: String, required: true },
      url: { type: String, required: true },
      size: Number,
      mimeType: String,
      uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      uploadedAt: { type: Date, default: Date.now },
    }],
    // Project Management Enhancement: Comments count (denormalized for performance)
    commentsCount: {
      type: Number,
      default: 0,
    },
    // Milestone reference
    milestone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Milestone',
      index: true,
    },
    // Custom fields (dynamic schema for organization-specific fields)
    customFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Estimated hours for time tracking
    estimatedHours: {
      type: Number,
      min: 0,
    },
    actualHours: {
      type: Number,
      min: 0,
      default: 0,
    },
    // Checklist items
    checklist: [{
      label: { type: String, required: true },
      completed: { type: Boolean, default: false },
      completedAt: Date,
      completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    }],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    completedAt: {
      type: Date,
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // CRM integration (keep existing for backward compatibility)
    relatedType: {
      type: String,
      enum: ['lead', 'deal', 'account', 'contact', 'customer', 'none', 'project'],
      default: 'none',
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'relatedType',
    },
    remindBeforeMin: {
      type: Number,
      default: 0,
    },
    reminderSent: {
      type: Boolean,
      default: false,
    },
    // Approval workflow
    requiresApproval: {
      type: Boolean,
      default: false,
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'not-required'],
      default: 'not-required',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
TaskSchema.index({ organization: 1, status: 1, dueDate: 1 });
TaskSchema.index({ organization: 1, assigneeId: 1, status: 1 });
TaskSchema.index({ organization: 1, relatedType: 1, relatedId: 1 });
TaskSchema.index({ organization: 1, project: 1, status: 1 });
TaskSchema.index({ organization: 1, sprint: 1, status: 1 });
TaskSchema.index({ organization: 1, parentTask: 1 });
TaskSchema.index({ organization: 1, milestone: 1 });

module.exports = mongoose.model('Task', TaskSchema);
