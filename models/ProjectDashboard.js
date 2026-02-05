const mongoose = require('mongoose');

const WidgetSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'task_summary',
      'burndown_chart',
      'velocity_chart',
      'task_distribution',
      'team_workload',
      'upcoming_deadlines',
      'health_score',
      'budget_tracker',
      'recent_activity',
      'milestone_progress',
      'sprint_progress',
    ],
    required: true,
  },
  title: {
    type: String,
  },
  position: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    width: { type: Number, default: 2 },
    height: { type: Number, default: 2 },
  },
  config: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
  visible: {
    type: Boolean,
    default: true,
  },
}, { _id: true });

const ProjectDashboardSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    default: 'My Dashboard',
  },
  description: {
    type: String,
    trim: true,
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
  // Dashboard layout and widgets
  widgets: [WidgetSchema],
  // Layout configuration
  layout: {
    columns: { type: Number, default: 12 },
    rowHeight: { type: Number, default: 100 },
    compactType: { type: String, enum: ['vertical', 'horizontal', null], default: 'vertical' },
  },
  // Filters applied to dashboard
  filters: {
    dateRange: {
      start: Date,
      end: Date,
      preset: { type: String, enum: ['today', 'week', 'month', 'quarter', 'year', 'custom'] },
    },
    assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    statuses: [{ type: String }],
    priorities: [{ type: String }],
    sprints: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Sprint' }],
    milestones: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Milestone' }],
  },
  // Refresh settings
  autoRefresh: {
    enabled: { type: Boolean, default: false },
    intervalMinutes: { type: Number, default: 5, min: 1, max: 60 },
  },
  // Sharing settings
  shared: {
    enabled: { type: Boolean, default: false },
    sharedWith: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      permission: { type: String, enum: ['view', 'edit'], default: 'view' },
    }],
    shareWithTeam: { type: Boolean, default: false },
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Compound indexes
ProjectDashboardSchema.index({ organization: 1, project: 1, user: 1 });
ProjectDashboardSchema.index({ organization: 1, user: 1, isDefault: 1 });

// Method to update last accessed time
ProjectDashboardSchema.methods.markAccessed = function() {
  this.lastAccessedAt = new Date();
  return this.save();
};

// Static method to get default dashboard for user
ProjectDashboardSchema.statics.getDefaultDashboard = async function(organizationId, projectId, userId) {
  let dashboard = await this.findOne({
    organization: organizationId,
    project: projectId,
    user: userId,
    isDefault: true,
  });
  
  // If no default dashboard exists, create one with default widgets
  if (!dashboard) {
    dashboard = new this({
      organization: organizationId,
      project: projectId,
      user: userId,
      name: 'My Dashboard',
      isDefault: true,
      widgets: [
        { type: 'task_summary', position: { x: 0, y: 0, width: 3, height: 2 } },
        { type: 'health_score', position: { x: 3, y: 0, width: 3, height: 2 } },
        { type: 'upcoming_deadlines', position: { x: 6, y: 0, width: 6, height: 2 } },
        { type: 'burndown_chart', position: { x: 0, y: 2, width: 6, height: 3 } },
        { type: 'velocity_chart', position: { x: 6, y: 2, width: 6, height: 3 } },
        { type: 'team_workload', position: { x: 0, y: 5, width: 6, height: 3 } },
        { type: 'recent_activity', position: { x: 6, y: 5, width: 6, height: 3 } },
      ],
    });
    await dashboard.save();
  }
  
  return dashboard;
};

module.exports = mongoose.model('ProjectDashboard', ProjectDashboardSchema);

